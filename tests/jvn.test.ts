import { describe, expect, it } from 'vitest'
import { parseRss } from '../src/worker/adapters/rss'
import { JVN_FEED_URL, jvnSecurity, normalizeJvnItem } from '../src/worker/sources/jvn'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixture } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')
const context = {
  now,
  env: {},
  fetch: fakeFetch({ [JVN_FEED_URL]: 'jvn.rdf' }),
} as SourceContext

describe('JVN security source', () => {
  it('collects Developer Stack alerts with upstream dates and CVEs, without inferred severity', async () => {
    const result = await jvnSecurity.collect(context)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      source: 'jvn-security',
      providerId: 'jvn',
      kind: 'security',
      cves: ['CVE-2026-66662'],
      publishedAt: '2026-10-23T07:00:00.000Z',
      updatedAt: '2026-10-23T07:00:00.000Z',
    })
    expect(result[0]?.severity).toBeUndefined()
    expect(result[0]?.raw).toEqual(parseRss(fixture('jvn.rdf'))[0]?.raw)
  })

  it('rejects invalid dates and unsafe links', () => {
    const item = parseRss(fixture('jvn.rdf'))[0]!
    expect(normalizeJvnItem({ ...item, pubDate: 'invalid' }, now)).toBeUndefined()
    for (const link of [
      undefined,
      'invalid',
      'javascript:alert(1)',
      'https://jvn.jp.evil.test/',
      'https://user@jvn.jp/',
    ]) {
      expect(normalizeJvnItem({ ...item, link }, now)).toBeUndefined()
    }
  })

  it('reports HTTP failures and unexpected documents', async () => {
    await expect(jvnSecurity.collect({ ...context, fetch: fakeFetch({}) })).rejects.toThrow(
      'HTTP 404',
    )
    await expect(
      jvnSecurity.collect({
        ...context,
        fetch: fakeFetch({ [JVN_FEED_URL]: () => new Response('<html>error</html>') }),
      }),
    ).rejects.toThrow('Unexpected JVN RSS format')
    expect(
      await jvnSecurity.collect({
        ...context,
        fetch: fakeFetch({ [JVN_FEED_URL]: () => new Response('<rdf:RDF><channel/></rdf:RDF>') }),
      }),
    ).toEqual([])
  })
})
