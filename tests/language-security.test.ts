import { describe, expect, it } from 'vitest'
import type { IncidentView } from '../src/shared/api'
import { matchesEcosystem, SECURITY_LANGUAGES } from '../src/shared/security'
import { deduplicateSecurity } from '../src/worker/services/security.service'
import type { GithubAdvisory } from '../src/worker/sources/github-advisory'
import { LanguageAdvisorySource } from '../src/worker/sources/language-advisories'
import {
  dotnetSource,
  goRuntimeSecurity,
  normalizeGoVulnerability,
  normalizeJavaNotice,
  rustRuntimeSecurity,
} from '../src/worker/sources/runtime-security'
import type { SourceContext } from '../src/worker/sources/types'

const now = new Date('2026-10-23T10:30:00Z')
const advisory = (id: string, severity = 'critical', ecosystem = 'go'): GithubAdvisory => ({
  ghsa_id: id,
  cve_id: 'CVE-2026-12345',
  html_url: `https://github.com/advisories/${id}`,
  summary: 'Example vulnerability',
  severity,
  published_at: '2026-10-22T00:00:00Z',
  vulnerabilities: [{ package: { ecosystem, name: 'example/package' } }],
})

function context(respond: (url: URL, init?: RequestInit) => unknown): SourceContext {
  return {
    now,
    env: { GITHUB_TOKEN: 'test-token' },
    fetch: (async (input, init) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input : input.url,
      )
      const value = respond(url, init)
      return value instanceof Response ? value : Response.json(value)
    }) as typeof fetch,
  } as SourceContext
}

const view = (id: string, cves: string[], ecosystem = 'go'): IncidentView => ({
  id,
  externalId: id,
  kind: 'security',
  source: 'test',
  title: id,
  url: 'https://example.com/advisory',
  severity: 'critical',
  ecosystem,
  cves,
  publishedAt: now.toISOString(),
  collectedAt: now.toISOString(),
})

describe('language advisory collection', () => {
  it.each(SECURITY_LANGUAGES)(
    'collects both severities for $label and scopes package metadata',
    async language => {
      const seen: string[] = []
      const result = await new LanguageAdvisorySource(language).collect(
        context((url, init) => {
          expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token')
          expect(url.searchParams.get('ecosystem')).toBe(language.ecosystem)
          expect(url.searchParams.get('sort')).toBe('updated')
          const severity = url.searchParams.get('severity')!
          seen.push(severity)
          return [
            {
              ...advisory(`GHSA-${severity}`, severity, language.ecosystem),
              vulnerabilities: [
                { package: { ecosystem: 'unrelated', name: 'unrelated-package' } },
                { package: { ecosystem: language.ecosystem, name: 'target-package' } },
              ],
            },
          ]
        }),
      )
      expect(seen).toEqual(['critical', 'high'])
      expect(result.map(i => [i.severity, i.ecosystem, i.product, i.providerId])).toEqual([
        ['critical', language.ecosystem, 'target-package', language.providerId],
        ['high', language.ecosystem, 'target-package', language.providerId],
      ])
    },
  )

  it('follows a second page and preserves withdrawn records', async () => {
    const result = await new LanguageAdvisorySource(SECURITY_LANGUAGES[0]).collect(
      context(url => {
        if (url.searchParams.get('severity') === 'high') return []
        if (!url.searchParams.has('after')) {
          const next = new URL(url)
          next.searchParams.set('after', 'cursor2')
          return Response.json(
            Array.from({ length: 100 }, (_, i) => advisory(`GHSA-page1-${i}`)),
            { headers: { Link: `<${next}>; rel="next"` } },
          )
        }
        return [{ ...advisory('GHSA-withdrawn'), withdrawn_at: now.toISOString() }]
      }),
    )
    expect(result).toHaveLength(101)
    expect(result.at(-1)).toMatchObject({ externalId: 'GHSA-withdrawn', status: 'withdrawn' })
  })

  it('does not send the token to an external pagination host', async () => {
    let calls = 0
    await expect(
      new LanguageAdvisorySource(SECURITY_LANGUAGES[0]).collect(
        context(() => {
          calls++
          return Response.json([advisory('GHSA-example')], {
            headers: { Link: '<https://example.com/steal>; rel="next"' },
          })
        }),
      ),
    ).rejects.toThrow('Unexpected GitHub pagination URL')
    expect(calls).toBe(1)
  })

  it('does not silently report success when a later page fails', async () => {
    await expect(
      new LanguageAdvisorySource(SECURITY_LANGUAGES[0]).collect(
        context(url => {
          if (url.searchParams.has('after')) return new Response('unavailable', { status: 503 })
          const next = new URL(url)
          next.searchParams.set('after', 'cursor2')
          return Response.json(
            Array.from({ length: 100 }, (_, i) => advisory(`GHSA-${i}`)),
            { headers: { Link: `<${next}>; rel="next"` } },
          )
        }),
      ),
    ).rejects.toThrow('HTTP 503')
  })
})

describe('security deduplication', () => {
  it('includes PHP runtime and Composer packages in the PHP filter', () => {
    expect(matchesEcosystem(view('php-release', [], 'php'), 'composer')).toBe(true)
    expect(matchesEcosystem(view('composer-advisory', [], 'composer'), 'composer')).toBe(true)
    expect(matchesEcosystem(view('go-advisory', [], 'go'), 'composer')).toBe(false)
  })

  it('merges CVE/GHSA bridges without losing language membership', () => {
    const merged = deduplicateSecurity([
      view('GO-2026-1', ['CVE-2026-11111']),
      view('GHSA-example', ['CVE-2026-22222'], 'nuget'),
      {
        ...view('GHSA-example', ['CVE-2026-11111', 'CVE-2026-22222'], 'rust'),
        id: 'mirror:GHSA-example',
      },
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.ecosystems?.sort()).toEqual(['go', 'nuget', 'rust'])
    expect(matchesEcosystem(merged[0]!, 'rust')).toBe(true)
    expect(matchesEcosystem(merged[0]!, 'maven')).toBe(false)
  })

  it('hides a withdrawn GHSA even if another source still has its active copy', () => {
    const active = view('GHSA-example', ['CVE-2026-11111'])
    expect(deduplicateSecurity([active, { ...active, id: 'mirror', status: 'withdrawn' }])).toEqual(
      [],
    )
    expect(deduplicateSecurity([active, view('other', ['CVE-2026-22222'])])).toHaveLength(2)
  })
})

describe('official runtime notices', () => {
  it('only accepts Go stdlib/toolchain records and does not invent severity', () => {
    const record = {
      id: 'GO-2026-1',
      summary: 'Go stdlib fix',
      published: now.toISOString(),
      aliases: ['CVE-2026-11111'],
      affected: [{ package: { name: 'stdlib' } }],
    }
    expect(normalizeGoVulnerability(record, now)).toMatchObject({
      ecosystem: 'go',
      cves: ['CVE-2026-11111'],
    })
    expect(normalizeGoVulnerability(record, now)?.severity).toBeUndefined()
    expect(
      normalizeGoVulnerability(
        { ...record, affected: [{ package: { name: 'third.party/module' } }] },
        now,
      ),
    ).toBeUndefined()
  })

  it('deduplicates Go IDs shared by stdlib/toolchain in the upstream index', async () => {
    let recordsFetched = 0
    const result = await goRuntimeSecurity.collect(
      context(url => {
        if (url.pathname === '/index/modules.json')
          return ['stdlib', 'toolchain'].map(path => ({
            path,
            vulns: [{ id: 'GO-2026-1', modified: now.toISOString() }],
          }))
        recordsFetched++
        return {
          id: 'GO-2026-1',
          published: now.toISOString(),
          affected: [{ package: { name: 'stdlib' } }],
        }
      }),
    )
    expect(recordsFetched).toBe(1)
    expect(result).toHaveLength(1)
  })

  it('extracts Java CVEs only from the Java SE matrix, preserving the upstream score', () => {
    const item = {
      title: 'Oracle CPU',
      link: 'https://www.oracle.com/security-alerts/cpuoct2026.html',
      pubDate: now.toISOString(),
      raw: {},
    }
    const html = `<p>Database CVE-2026-99999</p><!-- START Oracle Java SE RISK MATRIX --><table><tr><th>CVE-2026-11111</th><td>Oracle Java SE</td><td>JSSE</td><td>TLS</td><td>Yes</td><td>9.1</td></tr></table><!-- END Oracle Java SE RISK MATRIX -->`
    const result = normalizeJavaNotice(item, html, now)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ cves: ['CVE-2026-11111'], ecosystem: 'maven' })
    expect(result[0]?.description).toContain('9.1')
    expect(result[0]?.severity).toBeUndefined()
    expect(normalizeJavaNotice(item, '<h1>Oracle Database update</h1>', now)).toEqual([])
  })

  it('does not turn normal Rust releases into security notices', async () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>release</id><title>Announcing Rust</title><published>2026-10-22T00:00:00Z</published><link href="https://blog.rust-lang.org/release/"/></entry><entry><id>security</id><title>Security advisory for Rust</title><published>2026-10-22T00:00:00Z</published><link href="https://blog.rust-lang.org/security/"/><content>CVE-2026-11111</content></entry></feed>`
    const result = await rustRuntimeSecurity.collect(context(() => new Response(xml)))
    expect(result.map(i => i.externalId)).toEqual(['security'])
  })

  it('collects .NET runtime advisories outside the global reviewed feed', async () => {
    const result = await dotnetSource('runtime').collect(
      context(url => {
        expect(url.pathname).toBe('/repos/dotnet/runtime/security-advisories')
        return [advisory('GHSA-dotnet', 'high', 'nuget'), advisory('GHSA-low', 'low', 'nuget')]
      }),
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ providerId: 'dotnet', ecosystem: 'nuget', severity: 'high' })
  })
})
