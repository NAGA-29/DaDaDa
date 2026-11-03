import { describe, expect, it } from 'vitest'
import { matchesDeveloperStack } from '../src/worker/lib/developer-stack'
import { composerSecurity } from '../src/worker/sources/composer'
import type { GithubAdvisory } from '../src/worker/sources/github-advisory'
import { laravelSecurity } from '../src/worker/sources/laravel'
import { npmSecurity } from '../src/worker/sources/npm'
import { redisSecurity } from '../src/worker/sources/redis'
import type { SourceContext } from '../src/worker/sources/types'
import { fixtureJson } from './helpers'

describe('review regressions', () => {
  it('matches supported C# and NuGet notices while excluding Linux kernel alone', () => {
    for (const title of ['C# compiler vulnerability', 'NuGet security update']) {
      expect(matchesDeveloperStack(title)).toBe(true)
    }
    for (const title of ['Linux kernel vulnerability', 'Linuxカーネルの脆弱性', 'C#ish']) {
      expect(matchesDeveloperStack(title)).toBe(false)
    }
  })

  it.each([laravelSecurity, redisSecurity])(
    'only imports published advisories from $id',
    async source => {
      const item = fixtureJson<GithubAdvisory[]>('laravel-advisories.json')[0]!
      const result = await source.collect({
        now: new Date('2026-11-03T00:00:00Z'),
        env: { GITHUB_TOKEN: 'test-token' },
        fetch: (async input => {
          expect(new URL(String(input)).searchParams.get('state')).toBe('published')
          return Response.json(
            ['published', 'draft', 'triage', 'closed', undefined].map((state, i) => ({
              ...item,
              ghsa_id: `GHSA-state-${i}`,
              state,
            })),
          )
        }) as typeof fetch,
      } as SourceContext)
      expect(result.map(i => i.externalId)).toEqual(['GHSA-state-0'])
    },
  )

  it.each([npmSecurity, composerSecurity])(
    'paginates and refreshes downgrades for $id',
    async source => {
      const ecosystem = source.language.ecosystem
      const items = fixtureJson<GithubAdvisory[]>(`${ecosystem}-advisories.json`)
      const downgraded = { ...items[1]!, severity: 'medium' }
      const withdrawn = { ...items[0]!, severity: 'low', withdrawn_at: '2026-11-03T00:00:00Z' }
      const seen: string[] = []
      const result = await source.collect({
        now: new Date('2026-11-03T00:00:00Z'),
        env: {},
        fetch: (async input => {
          const url = new URL(String(input))
          seen.push(url.toString())
          if (url.searchParams.has('severity')) return Response.json([])
          if (url.searchParams.has('after')) return Response.json([withdrawn])
          const next = new URL(url)
          next.searchParams.set('after', 'page2')
          return Response.json([downgraded], { headers: { Link: `<${next}>; rel="next"` } })
        }) as typeof fetch,
      } as SourceContext)
      expect(seen).toHaveLength(4)
      expect(result).toMatchObject([
        { externalId: downgraded.ghsa_id, severity: 'medium', ecosystem },
        { externalId: withdrawn.ghsa_id, severity: 'low', status: 'withdrawn', ecosystem },
      ])
    },
  )
})
