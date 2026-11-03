import { describe, expect, it } from 'vitest'
import type { GithubAdvisory } from '../src/worker/sources/github-advisory'
import { LARAVEL_ADVISORIES_URL, laravelSecurity } from '../src/worker/sources/laravel'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixtureJson } from './helpers'

const now = new Date('2026-11-03T00:00:00Z')
const context = {
  now,
  env: {},
  fetch: fakeFetch({ [LARAVEL_ADVISORIES_URL]: 'laravel-advisories.json' }),
} as SourceContext

describe('Laravel security source', () => {
  it('collects official notices, including downgraded ones, with upstream severity and Composer metadata', async () => {
    const items = fixtureJson<GithubAdvisory[]>('laravel-advisories.json')
    const result = await laravelSecurity.collect(context)
    expect(result).toHaveLength(3)
    expect(result.map(i => i.severity)).toEqual(['critical', 'high', 'low'])
    expect(result[0]).toMatchObject({
      providerId: 'laravel',
      source: 'laravel-security',
      ecosystem: 'composer',
      externalId: items[0]!.ghsa_id,
      publishedAt: new Date(items[0]!.published_at).toISOString(),
      cves: [items[0]!.cve_id],
      raw: items[0],
    })
    expect(result[0]?.product).toContain('laravel/')
  })

  it('retains withdrawn lower-severity notices and uses configured authentication', async () => {
    const items = fixtureJson<GithubAdvisory[]>('laravel-advisories.json')
    items[2]!.withdrawn_at = now.toISOString()
    const result = await laravelSecurity.collect({
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
      severity: 'low',
    })
  })

  it('reports upstream failures', async () => {
    await expect(laravelSecurity.collect({ ...context, fetch: fakeFetch({}) })).rejects.toThrow(
      'HTTP 404',
    )
  })

  it('follows rel="next" pagination and rejects foreign next URLs', async () => {
    const items = fixtureJson<GithubAdvisory[]>('laravel-advisories.json')
    const calls: string[] = []
    const paged = (next: string | undefined) =>
      (async (url: RequestInfo | URL) => {
        calls.push(String(url))
        const first = calls.length === 1
        return Response.json(first ? items.slice(0, 1) : items.slice(1), {
          headers: first && next ? { Link: `<${next}>; rel="next"` } : {},
        })
      }) as typeof fetch
    const ok = await laravelSecurity.collect({
      ...context,
      fetch: paged(`${LARAVEL_ADVISORIES_URL}&page=2`),
    })
    expect(ok).toHaveLength(3)
    expect(calls).toHaveLength(2)
    calls.length = 0
    await expect(
      laravelSecurity.collect({ ...context, fetch: paged('https://evil.example/x') }),
    ).rejects.toThrow('Unexpected GitHub pagination URL')
  })
})
