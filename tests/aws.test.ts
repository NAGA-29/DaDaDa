import { describe, expect, it } from 'vitest'
import { parseRss } from '../src/worker/adapters/rss'
import { incidentId } from '../src/worker/domain/fingerprint'
import { isHappeningNow } from '../src/worker/domain/incident'
import { normalizeAwsNotice, awsNotices, AWS_FEED_URL } from '../src/worker/sources/aws'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixture } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')

describe('AWS official notices', () => {
  it('preserves distinct GUID fragments for a shared link and converts PDT publication dates', async () => {
    const items = parseRss(fixture('aws-notices.xml'))
    const notices = items.map(item => normalizeAwsNotice(item, now)!)
    expect(notices[0]).toMatchObject({
      title: 'Service disruption: Increased Error Rates',
      product: 'ec2 · ap-northeast-1',
      status: 'notice',
      publishedAt: '2026-10-22T10:00:00.000Z',
      url: expect.stringContaining('#ec2-ap-northeast-1_1792652400'),
    })
    expect(notices[2]?.product).toBe('route53 · global')
    const ids = await Promise.all(notices.map(incidentId))
    expect(new Set(ids).size).toBe(3)
    expect(await incidentId(normalizeAwsNotice(items[0]!, now)!)).toBe(ids[0])
  })

  it('does not infer current outages, recoveries or severity from announcement titles', () => {
    for (const item of parseRss(fixture('aws-notices.xml'))) {
      const notice = normalizeAwsNotice(item, now)!
      expect(notice.status).toBe('notice')
      expect(notice.severity).toBeUndefined()
      expect(notice.resolvedAt).toBeUndefined()
      expect(isHappeningNow(notice, now)).toBe(false)
    }
  })

  it('rejects missing dates and links outside the official domain', () => {
    const item = parseRss(fixture('aws-notices.xml'))[0]!
    expect(normalizeAwsNotice({ ...item, pubDate: undefined }, now)).toBeUndefined()
    expect(normalizeAwsNotice({ ...item, guid: 'javascript:alert(1)' }, now)).toBeUndefined()
    expect(
      normalizeAwsNotice({ ...item, guid: 'https://status.aws.amazon.com.example.com/' }, now),
    ).toBeUndefined()
  })

  it('keeps unfamiliar GUID scopes without inventing a service or region', () => {
    const item = parseRss(fixture('aws-notices.xml'))[0]!
    const notice = normalizeAwsNotice(
      { ...item, guid: 'https://health.aws.amazon.com/health/status?eventID=example' },
      now,
    )!
    expect(notice.product).toBeUndefined()
    expect(notice.externalId).toContain('eventID=example')
    const fallback = normalizeAwsNotice({ ...item, guid: undefined }, now)!
    expect(fallback.url).toBe(item.link)
  })

  it('collects notices but keeps availability unverified even for an empty feed', async () => {
    const context = {
      now,
      env: {},
      fetch: fakeFetch({ [AWS_FEED_URL]: 'aws-notices.xml' }),
    } as SourceContext
    expect(await awsNotices.collect(context)).toHaveLength(3)
    expect(await awsNotices.collectStatus(context)).toMatchObject({ status: 'unverified' })
    const empty = {
      ...context,
      fetch: fakeFetch({ [AWS_FEED_URL]: () => new Response('<rss><channel/></rss>') }),
    }
    expect(await awsNotices.collect(empty)).toEqual([])
    expect((await awsNotices.collectStatus(empty)).status).toBe('unverified')
  })

  it('reports fetch and unexpected feed format errors', async () => {
    const context = { now, env: {}, fetch: fakeFetch({}) } as SourceContext
    await expect(awsNotices.collect(context)).rejects.toThrow('HTTP 404')
    await expect(
      awsNotices.collect({
        ...context,
        fetch: fakeFetch({ [AWS_FEED_URL]: () => new Response('<html>error</html>') }),
      }),
    ).rejects.toThrow('Unexpected AWS RSS format')
  })
})
