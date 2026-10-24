import { describe, expect, it } from 'vitest'
import { parseRss } from '../src/worker/adapters/rss'
import { incidentId } from '../src/worker/domain/fingerprint'
import { isHappeningNow } from '../src/worker/domain/incident'
import { AZURE_FEED_URL, azureNotices, normalizeAzureNotice } from '../src/worker/sources/azure'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixture } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')
const items = parseRss(fixture('azure-notices.xml'))
const context = {
  now,
  env: {},
  fetch: fakeFetch({ [AZURE_FEED_URL]: 'azure-notices.xml' }),
} as SourceContext

describe('Azure official notices', () => {
  it('keeps opaque GUIDs separate from article URLs, preserving query IDs and raw data', async () => {
    const notices = await azureNotices.collect(context)
    expect(notices).toHaveLength(2)
    expect(notices[0]).toMatchObject({
      externalId: 'TEST-001',
      url: 'https://azure.status.microsoft/en-us/status/?trackingId=TEST-001',
      publishedAt: '2026-10-23T08:00:00.000Z',
      description: 'Investigating connectivity issues. Details',
      raw: items[0]!.raw,
    })
    expect(await incidentId(notices[0]!)).not.toBe(await incidentId(notices[1]!))
    expect(await incidentId(normalizeAzureNotice(items[0]!, now)!)).toBe(
      await incidentId(notices[0]!),
    )
    expect(normalizeAzureNotice({ ...items[0]!, guid: undefined }, now)?.externalId).toBe(
      items[0]!.link,
    )
  })

  it('does not infer active incidents, recovery or severity from titles', async () => {
    for (const notice of await azureNotices.collect(context)) {
      expect(notice.status).toBe('notice')
      expect(notice.resolvedAt).toBeUndefined()
      expect(notice.severity).toBeUndefined()
      expect(isHappeningNow(notice, now)).toBe(false)
    }
  })

  it('rejects invalid dates, missing links, credentials and unofficial URLs', () => {
    expect(normalizeAzureNotice({ ...items[0]!, pubDate: 'invalid' }, now)).toBeUndefined()
    expect(normalizeAzureNotice({ ...items[0]!, link: undefined }, now)).toBeUndefined()
    for (const link of [
      'javascript:alert(1)',
      'https://azure.status.microsoft.example.com/',
      'https://user:password@azure.status.microsoft/',
      'http://azure.status.microsoft/',
    ]) {
      expect(normalizeAzureNotice({ ...items[0]!, link }, now)).toBeUndefined()
    }
  })

  it('accepts an empty feed without claiming normal availability', async () => {
    const empty = {
      ...context,
      fetch: fakeFetch({
        [AZURE_FEED_URL]: () => new Response('<rss version="2.0"><channel/></rss>'),
      }),
    }
    expect(await azureNotices.collect(empty)).toEqual([])
    expect((await azureNotices.collectStatus(empty)).status).toBe('unverified')
  })

  it('reports fetch failures and HTML responses', async () => {
    await expect(azureNotices.collect({ ...context, fetch: fakeFetch({}) })).rejects.toThrow(
      'HTTP 404',
    )
    await expect(
      azureNotices.collect({
        ...context,
        fetch: fakeFetch({ [AZURE_FEED_URL]: () => new Response('<html>error</html>') }),
      }),
    ).rejects.toThrow('Unexpected Azure RSS format')
  })
})
