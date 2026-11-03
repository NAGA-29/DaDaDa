import { describe, expect, it } from 'vitest'
import type { GithubAdvisory } from '../src/worker/sources/github-advisory'
import { npmSecurity } from '../src/worker/sources/npm'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixtureJson } from './helpers'

const now = new Date('2026-11-03T00:00:00Z')

describe('npm security source', () => {
  it('polls reviewed npm High/Critical separately and scopes package metadata', async () => {
    const seen: (string | null)[] = []
    const items = fixtureJson<GithubAdvisory[]>('npm-advisories.json')
    const result = await npmSecurity.collect({
      now,
      env: {},
      fetch: (async input => {
        const url = new URL(String(input))
        expect(url.pathname).toBe('/advisories')
        expect(url.searchParams.get('type')).toBe('reviewed')
        expect(url.searchParams.get('ecosystem')).toBe('npm')
        const severity = url.searchParams.get('severity')!
        seen.push(severity)
        return Response.json(items.filter(i => !severity || i.severity === severity))
      }) as typeof fetch,
    } as SourceContext)
    expect(seen).toEqual(['critical', 'high', null])
    expect(result).toHaveLength(2)
    expect(result.map(i => [i.source, i.providerId, i.ecosystem, i.severity])).toEqual([
      ['github-advisory-npm', 'nodejs', 'npm', 'critical'],
      ['github-advisory-npm', 'nodejs', 'npm', 'high'],
    ])
    expect(result[0]?.product).toContain(items[0]!.vulnerabilities![0]!.package!.name)
    expect(result[0]?.raw).toEqual(items[0])
  })

  it('reports upstream failures', async () => {
    await expect(
      npmSecurity.collect({ now, env: {}, fetch: fakeFetch({}) } as SourceContext),
    ).rejects.toThrow('HTTP 404')
  })
})
