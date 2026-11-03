import { describe, expect, it } from 'vitest'
import { parseRss } from '../src/worker/adapters/rss'
import { IPA_FEED_URL, ipaSecurity, normalizeIpaItem } from '../src/worker/sources/ipa'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixture } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')
const context = {
  now,
  env: {},
  fetch: fakeFetch({ [IPA_FEED_URL]: 'ipa.rdf' }),
} as SourceContext

describe('IPA security source', () => {
  it('collects Developer Stack alerts with upstream dates and CVEs, without inferred severity', async () => {
    const result = await ipaSecurity.collect(context)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      source: 'ipa-security',
      providerId: 'ipa',
      kind: 'security',
      cves: ['CVE-2026-66661'],
      publishedAt: '2026-10-23T07:00:00.000Z',
      updatedAt: '2026-10-23T07:00:00.000Z',
    })
    expect(result[0]?.severity).toBeUndefined()
    expect(result[0]?.raw).toEqual(parseRss(fixture('ipa.rdf'))[0]?.raw)
  })

  it('rejects invalid dates and unsafe links', () => {
    const item = parseRss(fixture('ipa.rdf'))[0]!
    expect(normalizeIpaItem({ ...item, pubDate: 'invalid' }, now)).toBeUndefined()
    for (const link of [
      undefined,
      'invalid',
      'javascript:alert(1)',
      'https://www.ipa.go.jp.evil.test/',
      'https://user@www.ipa.go.jp/',
    ]) {
      expect(normalizeIpaItem({ ...item, link }, now)).toBeUndefined()
    }
  })

  it('keeps the newest upstream date when the feed repeats an alert URL', async () => {
    const xml = fixture('ipa.rdf')
    const repeated = xml.replace(
      '</rdf:RDF>',
      `${xml.match(/<item>[\s\S]*?<\/item>/)![0].replace('2026-10-23', '2026-10-22')}</rdf:RDF>`,
    )
    const result = await ipaSecurity.collect({
      ...context,
      fetch: fakeFetch({ [IPA_FEED_URL]: () => new Response(repeated) }),
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.updatedAt).toBe('2026-10-23T07:00:00.000Z')
  })

  it('reports HTTP failures and unexpected documents', async () => {
    await expect(ipaSecurity.collect({ ...context, fetch: fakeFetch({}) })).rejects.toThrow(
      'HTTP 404',
    )
    await expect(
      ipaSecurity.collect({
        ...context,
        fetch: fakeFetch({ [IPA_FEED_URL]: () => new Response('<html>error</html>') }),
      }),
    ).rejects.toThrow('Unexpected IPA RSS format')
    expect(
      await ipaSecurity.collect({
        ...context,
        fetch: fakeFetch({ [IPA_FEED_URL]: () => new Response('<rdf:RDF><channel/></rdf:RDF>') }),
      }),
    ).toEqual([])
  })
})
