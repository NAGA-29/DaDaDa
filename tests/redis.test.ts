import { describe, expect, it } from 'vitest'
import type { GithubAdvisory } from '../src/worker/sources/github-advisory'
import { REDIS_ADVISORIES_URL, redisSecurity } from '../src/worker/sources/redis'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixtureJson } from './helpers'

const now = new Date('2026-11-03T00:00:00Z')
const context = {
  now,
  env: {},
  fetch: fakeFetch({ [REDIS_ADVISORIES_URL]: 'redis-advisories.json' }),
} as SourceContext

describe('Redis security source', () => {
  it('collects official High/Critical notices with upstream severity and package metadata', async () => {
    const items = fixtureJson<GithubAdvisory[]>('redis-advisories.json')
    const result = await redisSecurity.collect(context)
    expect(result).toHaveLength(2)
    expect(result.map(i => i.severity)).toEqual(['critical', 'high'])
    expect(result[0]).toMatchObject({
      providerId: 'redis',
      source: 'redis-security',
      externalId: items[0]!.ghsa_id,
      publishedAt: new Date(items[0]!.published_at).toISOString(),
      cves: [items[0]!.cve_id],
      raw: items[0],
    })
    expect(result[0]?.product).toBe('redis-server')
  })

  it('retains withdrawn lower-severity notices and uses configured authentication', async () => {
    const items = fixtureJson<GithubAdvisory[]>('redis-advisories.json')
    items[2]!.withdrawn_at = now.toISOString()
    const result = await redisSecurity.collect({
      ...context,
      env: { GITHUB_TOKEN: 'test-token' },
      fetch: (async (_url, init) => {
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token')
        return Response.json(items)
      }) as typeof fetch,
    })
    expect(result.at(-1)).toMatchObject({
      externalId: items[2]!.ghsa_id,
      status: 'withdrawn',
      severity: 'medium',
    })
  })

  it('reports upstream failures', async () => {
    await expect(redisSecurity.collect({ ...context, fetch: fakeFetch({}) })).rejects.toThrow(
      'HTTP 404',
    )
  })
})
