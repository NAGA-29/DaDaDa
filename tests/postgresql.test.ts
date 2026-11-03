import { describe, expect, it } from 'vitest'
import { parseRss } from '../src/worker/adapters/rss'
import {
  POSTGRESQL_FEED_URL,
  postgresqlSecurity,
  normalizePostgresqlItem,
} from '../src/worker/sources/postgresql'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixture } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')
const context = {
  now,
  env: {},
  fetch: fakeFetch({ [POSTGRESQL_FEED_URL]: 'postgresql.xml' }),
} as SourceContext

describe('PostgreSQL security source', () => {
  it('collects core security releases, excluding ordinary releases and extensions', async () => {
    const result = await postgresqlSecurity.collect(context)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      providerId: 'postgresql',
      source: 'postgresql-security',
      kind: 'security',
      product: 'PostgreSQL',
      cves: ['CVE-2026-66663', 'CVE-2026-66664'],
      publishedAt: '2026-10-23T07:00:00.000Z',
    })
    expect(result[0]?.severity).toBeUndefined()
    const item = parseRss(fixture('postgresql.xml'))[0]!
    expect(
      normalizePostgresqlItem(
        {
          ...item,
          title: 'PostgreSQL 18.6 Released!',
          description: 'This release fixes two security vulnerabilities.',
        },
        now,
      ),
    ).toBeDefined()
    expect(
      normalizePostgresqlItem(
        { ...item, description: 'This release contains no security fixes.' },
        now,
      ),
    ).toBeUndefined()
  })

  it('rejects invalid dates and unsafe links', () => {
    const item = parseRss(fixture('postgresql.xml'))[0]!
    expect(normalizePostgresqlItem({ ...item, pubDate: 'invalid' }, now)).toBeUndefined()
    for (const link of [
      undefined,
      'invalid',
      'javascript:alert(1)',
      'https://www.postgresql.org.evil.test/about/news/',
      'https://user@www.postgresql.org/about/news/',
      'https://www.postgresql.org/docs/',
    ]) {
      expect(normalizePostgresqlItem({ ...item, link }, now)).toBeUndefined()
    }
  })

  it('reports HTTP failures and unexpected documents', async () => {
    await expect(postgresqlSecurity.collect({ ...context, fetch: fakeFetch({}) })).rejects.toThrow(
      'HTTP 404',
    )
    await expect(
      postgresqlSecurity.collect({
        ...context,
        fetch: fakeFetch({ [POSTGRESQL_FEED_URL]: () => new Response('<html>error</html>') }),
      }),
    ).rejects.toThrow('Unexpected PostgreSQL RSS format')
    expect(
      await postgresqlSecurity.collect({
        ...context,
        fetch: fakeFetch({ [POSTGRESQL_FEED_URL]: () => new Response('<rss><channel/></rss>') }),
      }),
    ).toEqual([])
  })
})
