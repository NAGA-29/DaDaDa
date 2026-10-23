import { describe, expect, it } from 'vitest'
import { parseAtom } from '../src/worker/adapters/atom'
import { parseRss } from '../src/worker/adapters/rss'
import { normalizeKev, recentKev, type KevCatalog } from '../src/worker/sources/cisa-kev'
import { githubAdvisory, normalizeGithubAdvisory, type GithubAdvisory } from '../src/worker/sources/github-advisory'
import { normalizeNodeItem } from '../src/worker/sources/nodejs'
import { isPhpSecurityEntry, normalizePhpEntry, phpSecurity } from '../src/worker/sources/php'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixture, fixtureJson } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')

describe('PHP security source', () => {
  it('keeps only security entries and extracts CVEs', () => {
    const entries = parseAtom(fixture('php-feed.atom'))
    expect(entries).toHaveLength(2)
    expect(entries.map(isPhpSecurityEntry)).toEqual([true, false])

    const incident = normalizePhpEntry('php-security', entries[0]!, now)
    expect(incident).toMatchObject({
      kind: 'security',
      providerId: 'php',
      title: 'PHP 8.4.14 Released!',
      url: 'https://www.php.net/index.php#2026-10-22-1',
      externalId: 'https://www.php.net/archive/2026.php#2026-10-22-1',
      cves: ['CVE-2026-11111', 'CVE-2026-22222'],
      publishedAt: '2026-10-22T16:00:00.000Z',
    })
    expect(incident!.description).toContain('This is a security release.')
    expect(incident!.description).not.toContain('<p>')
  })

  it('decodes escaped html content', () => {
    expect(parseAtom(fixture('php-feed.atom'))[1]!.content).toBe('<p>Join us at the conference.</p>')
  })

  it('collects via fetch', async () => {
    const context = { now, fetch: fakeFetch({ 'https://www.php.net/feed.atom': 'php-feed.atom' }), env: {} } as SourceContext
    expect(await phpSecurity.collect(context)).toHaveLength(1)
  })
})

describe('Node.js security source', () => {
  it('parses the real vulnerability feed', () => {
    const items = parseRss(fixture('nodejs-vulnerability.xml'))
    expect(items.length).toBeGreaterThan(0)
    const incident = normalizeNodeItem('nodejs-security', items[0]!, now)
    expect(incident).toMatchObject({
      kind: 'security',
      providerId: 'nodejs',
      title: 'Wednesday, October 21, 2026 Security Releases',
      externalId: 'https://nodejs.org/en/blog/vulnerability/october-2026-security-releases',
      publishedAt: '2026-10-21T22:00:00.000Z',
    })
  })
})

describe('GitHub Advisory source', () => {
  it('normalizes advisories with upstream severity', () => {
    const [advisory] = fixtureJson<GithubAdvisory[]>('github-advisories.json')
    expect(normalizeGithubAdvisory('github-advisory', advisory!, now)).toMatchObject({
      externalId: 'GHSA-aaaa-bbbb-cccc',
      severity: 'critical',
      ecosystem: 'npm',
      product: 'example-lib',
      cves: ['CVE-2026-33333'],
    })
  })

  it('marks withdrawn advisories and sends a token when configured', async () => {
    let auth: string | null = null
    const fetcher = (async (_url: string, init?: RequestInit) => {
      auth = new Headers(init?.headers).get('Authorization')
      return new Response(fixture('github-advisories.json'))
    }) as typeof fetch
    const result = await githubAdvisory.collect({ now, fetch: fetcher, env: { GITHUB_TOKEN: 't0ken' } } as SourceContext)
    expect(result.map(r => [r.externalId, r.status])).toEqual([
      ['GHSA-aaaa-bbbb-cccc', undefined],
      ['GHSA-dddd-eeee-ffff', 'withdrawn'],
    ])
    expect(auth).toBe('Bearer t0ken')
  })
})

describe('CISA KEV source', () => {
  it('only keeps recently added vulnerabilities', () => {
    const recent = recentKev(fixtureJson<KevCatalog>('cisa-kev.json'), now)
    expect(recent.map(v => v.cveID)).toEqual(['CVE-2026-44444'])
    expect(normalizeKev('cisa-kev', recent[0]!, now)).toMatchObject({
      providerId: 'cisa-kev',
      product: 'Example Gateway',
      cves: ['CVE-2026-44444'],
      publishedAt: '2026-10-21T00:00:00.000Z',
      status: 'known_exploited',
    })
  })
})
