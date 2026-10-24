import { describe, expect, it } from 'vitest'
import { parseRss } from '../src/worker/adapters/rss'
import { incidentId } from '../src/worker/domain/fingerprint'
import { isHappeningNow } from '../src/worker/domain/incident'
import { normalizeSakuraNotice, sakuraNotices, SAKURA_FEED_URL } from '../src/worker/sources/sakura'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixture } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')

describe('Sakura official notices', () => {
  it('preserves query IDs, Japanese titles and JST publication dates', async () => {
    const items = parseRss(fixture('sakura-notices.xml'))
    const notices = items.map(item => normalizeSakuraNotice(item, now)!)
    expect(notices[0]).toMatchObject({
      title: '[障害] さくらのクラウドの一部',
      status: 'notice',
      publishedAt: '2026-10-23T06:00:00.000Z',
      url: expect.stringContaining('?id=10001'),
    })
    const ids = await Promise.all(notices.map(incidentId))
    expect(new Set(ids).size).toBe(3)
    expect(await incidentId(normalizeSakuraNotice(items[0]!, now)!)).toBe(ids[0])
  })

  it('does not infer current outages, recoveries or severity from announcement titles', () => {
    for (const item of parseRss(fixture('sakura-notices.xml'))) {
      const notice = normalizeSakuraNotice(item, now)!
      expect(notice.status).toBe('notice')
      expect(notice.severity).toBeUndefined()
      expect(notice.resolvedAt).toBeUndefined()
      expect(isHappeningNow(notice, now)).toBe(false)
    }
  })

  it('rejects missing dates and links outside the official domain', () => {
    const item = parseRss(fixture('sakura-notices.xml'))[0]!
    expect(normalizeSakuraNotice({ ...item, pubDate: undefined }, now)).toBeUndefined()
    expect(normalizeSakuraNotice({ ...item, link: 'javascript:alert(1)' }, now)).toBeUndefined()
    expect(
      normalizeSakuraNotice({ ...item, link: 'https://sakura.ad.jp.example.com/' }, now),
    ).toBeUndefined()
  })

  it('collects notices but keeps availability unverified even for an empty feed', async () => {
    const context = {
      now,
      env: {},
      fetch: fakeFetch({ [SAKURA_FEED_URL]: 'sakura-notices.xml' }),
    } as SourceContext
    expect(await sakuraNotices.collect(context)).toHaveLength(3)
    expect(await sakuraNotices.collectStatus(context)).toMatchObject({ status: 'unverified' })
    const empty = {
      ...context,
      fetch: fakeFetch({ [SAKURA_FEED_URL]: () => new Response('<rss><channel/></rss>') }),
    }
    expect(await sakuraNotices.collect(empty)).toEqual([])
    expect((await sakuraNotices.collectStatus(empty)).status).toBe('unverified')
  })

  it('reports fetch and unexpected feed format errors', async () => {
    const context = { now, env: {}, fetch: fakeFetch({}) } as SourceContext
    await expect(sakuraNotices.collect(context)).rejects.toThrow('HTTP 404')
    await expect(
      sakuraNotices.collect({
        ...context,
        fetch: fakeFetch({ [SAKURA_FEED_URL]: () => new Response('<html>error</html>') }),
      }),
    ).rejects.toThrow('Unexpected Sakura RSS format')
  })
})
