import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { toIncident } from '../src/worker/domain/fingerprint'
import { runCollectors } from '../src/worker/collectors/collector-runner'
import type { Bindings } from '../src/worker/env'
import { IncidentRepository } from '../src/worker/repositories/incident.repository'
import { getProviderDetail, getSummary } from '../src/worker/services/incident.service'
import { sources } from '../src/worker/sources'
import { fakeFetch, fixture } from './helpers'

// wrangler のローカル D1 (インメモリ) に migration を当てて、収集〜API 集約まで通す
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Bindings>>>
let env: Bindings

const now = new Date('2026-10-23T10:30:00Z')

const fetcher = fakeFetch({
  'https://www.sakura.ad.jp/rss/mainte.rdf': 'sakura-notices.xml',
  'https://www.netlifystatus.com/api/v2/summary.json': () =>
    Response.json({
      status: { indicator: 'none', description: 'All Systems Operational' },
      components: [],
    }),
  'https://www.netlifystatus.com/api/v2/incidents.json': () => Response.json({ incidents: [] }),
  'https://www.cloudflarestatus.com/api/v2/summary.json': 'statuspage-summary.json',
  'https://www.cloudflarestatus.com/api/v2/incidents.json': 'statuspage-incidents.json',
  'https://status.cloud.google.com/incidents.json': 'gcp-incidents.json',
  'https://www.php.net/feed.atom': 'php-feed.atom',
  'https://nodejs.org/en/feed/vulnerability.xml': 'nodejs-vulnerability.xml',
  'https://api.github.com/advisories': 'github-advisories.json',
  'https://www.cisa.gov/': 'cisa-kev.json',
  // GitHub / Vercel の Statuspage は 503 を返す → 他へ波及しないこと
  'https://www.githubstatus.com': () => new Response('unavailable', { status: 503 }),
  'https://www.vercel-status.com': () => {
    throw new Error('network down')
  },
})

beforeAll(async () => {
  proxy = await getPlatformProxy<Bindings>({ persist: false })
  env = proxy.env
  const sql = readFileSync(join(import.meta.dirname, '../migrations/0001_initial.sql'), 'utf8')
  const statements = sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
  await env.DB.batch(statements.map(s => env.DB.prepare(s)))
}, 60_000)

afterAll(async () => {
  await proxy?.dispose()
})

describe('collector runner + D1', () => {
  it('isolates failing sources and stores the rest', async () => {
    const result = await runCollectors(env, ['status', 'security'], { now, fetch: fetcher })
    const byId = Object.fromEntries(result.results.map(r => [r.sourceId, r]))

    expect(result.results).toHaveLength(sources.length)
    expect(byId['github-status']).toMatchObject({ ok: false })
    expect(byId['vercel-status']).toMatchObject({
      ok: false,
      error: 'status: network down; incidents: network down',
    })
    expect(byId['cloudflare-status']).toMatchObject({
      ok: true,
      incidents: 2,
      status: 'partial_outage',
    })
    expect(byId['google-cloud-status']).toMatchObject({
      ok: true,
      incidents: 2,
      status: 'partial_outage',
    })
    expect(byId['sakura-notices']).toMatchObject({ ok: true, incidents: 3, status: 'unverified' })
    expect(byId['netlify-status']).toMatchObject({ ok: true, incidents: 0, status: 'operational' })
    expect(byId['php-security']).toMatchObject({ ok: true, incidents: 1 })
    // withdrawn も status=withdrawn として保存される (一覧には出ない)
    expect(byId['github-advisory']).toMatchObject({ ok: true, incidents: 2 })
    expect(byId['cisa-kev']).toMatchObject({ ok: true, incidents: 1 })
  })

  it('deduplicates on re-run and keeps raw json', async () => {
    const repo = new IncidentRepository(env.DB)
    const before = await repo.list({ limit: 200 })
    await runCollectors(env, ['status', 'security'], { now, fetch: fetcher })
    const after = await repo.list({ limit: 200 })
    expect(after.items).toHaveLength(before.items.length)

    const detail = await repo.get('cloudflare-status:inc-active-1')
    expect(detail?.raw).toMatchObject({ id: 'inc-active-1', impact: 'major' })
  })

  it('paginates with a cursor', async () => {
    const repo = new IncidentRepository(env.DB)
    const all = await repo.list({ limit: 200 })
    const first = await repo.list({ limit: 3 })
    expect(first.nextCursor).not.toBeNull()
    const second = await repo.list({ limit: 200, cursor: first.nextCursor! })
    expect([...first.items, ...second.items].map(i => i.id)).toEqual(all.items.map(i => i.id))
  })

  it('builds the summary for the top page', async () => {
    const summary = await getSummary(env.DB, now)
    const titles = summary.happeningNow.map(i => i.title)
    // 未解決の Service Incident + 72h 以内の Security (KEV は別枠)
    expect(titles).toContain('Workers API elevated errors')
    expect(titles).toContain('Cloud Run: elevated latency in us-central1')
    expect(titles).toContain('PHP 8.4.14 Released!')
    expect(titles).not.toContain('R2 latency')
    expect(titles).not.toContain('Example Gateway Authentication Bypass Vulnerability')
    expect(summary.kev.map(i => i.externalId)).toEqual(['CVE-2026-44444'])
    expect(summary.happeningNow.every(i => !('raw' in i))).toBe(true)

    const services = Object.fromEntries(
      summary.services.map(s => [s.id, s.currentStatus?.status ?? null]),
    )
    expect(services).toEqual({
      cloudflare: 'partial_outage',
      github: null,
      'google-cloud': 'partial_outage',
      vercel: null,
      netlify: 'operational',
      sakura: 'unverified',
    })
  })

  it('shows Sakura in Services with notices, never as active or resolved incidents', async () => {
    const summary = await getSummary(env.DB, now)
    expect(summary.services.find(s => s.id === 'sakura')?.currentStatus?.status).toBe('unverified')
    expect(summary.serviceNotices?.filter(i => i.providerId === 'sakura')).toHaveLength(3)
    expect(summary.happeningNow.some(i => i.providerId === 'sakura')).toBe(false)
    const detail = await getProviderDetail(env.DB, 'sakura', now)
    expect(detail?.activeIncidents).toEqual([])
    expect(detail?.recentIncidents).toEqual([])
    expect(detail?.officialNotices).toHaveLength(3)
    expect(
      (await new IncidentRepository(env.DB).list({ providerId: 'sakura', active: true })).items,
    ).toEqual([])
    const staleDetail = await getProviderDetail(env.DB, 'sakura', new Date(now.getTime() + 3600000))
    expect(staleDetail?.currentStatus?.status).toBe('unverified')
  })

  it('returns provider detail', async () => {
    const detail = await getProviderDetail(env.DB, 'cloudflare')
    expect(detail?.activeIncidents.map(i => i.title)).toEqual(['Workers API elevated errors'])
    expect(detail?.recentIncidents.map(i => i.title)).toEqual(['R2 latency'])

    const php = await getProviderDetail(env.DB, 'php')
    expect(php?.currentStatus).toBeNull()
    expect(php?.securityAdvisories).toHaveLength(1)
  })

  it('keeps the successful half when status or incidents fail', async () => {
    const partial = fakeFetch({
      'https://www.githubstatus.com/api/v2/summary.json': 'statuspage-summary.json',
      'https://www.githubstatus.com/api/v2/incidents.json': () =>
        new Response('down', { status: 503 }),
    })
    const githubOnly = sources.filter(s => s.id === 'github-status')
    const result = await runCollectors(env, ['status'], {
      now,
      fetch: partial,
      sources: githubOnly,
    })
    expect(result.results[0]).toMatchObject({
      sourceId: 'github-status',
      ok: false,
      status: 'partial_outage',
      incidents: 0,
    })
    expect(result.results[0]!.error).toMatch(/^incidents: /)

    const summary = await getSummary(env.DB, now)
    expect(summary.services.find(s => s.id === 'github')?.currentStatus?.status).toBe(
      'partial_outage',
    )
  })

  it('reports stale statuses as unknown', async () => {
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const summary = await getSummary(env.DB, later)
    expect(summary.services.find(s => s.id === 'cloudflare')?.currentStatus?.status).toBe('unknown')
    expect((await getProviderDetail(env.DB, 'cloudflare', later))?.currentStatus?.status).toBe(
      'unknown',
    )
  })

  it('applies the KEV window when reading', async () => {
    const later = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000)
    expect((await getSummary(env.DB, later)).kev).toEqual([])
  })

  it('hides advisories that were withdrawn after being stored', async () => {
    const advisories = JSON.parse(fixture('github-advisories.json')) as {
      withdrawn_at?: string | null
    }[]
    advisories[0]!.withdrawn_at = '2026-10-23T09:00:00Z'
    const withdrawn = fakeFetch({
      'https://api.github.com/advisories': () => new Response(JSON.stringify(advisories)),
    })
    const ghsa = sources.filter(s => s.id === 'github-advisory')

    expect((await getSummary(env.DB, now)).security.map(i => i.externalId)).toContain(
      'GHSA-aaaa-bbbb-cccc',
    )
    await runCollectors(env, ['security'], { now, fetch: withdrawn, sources: ghsa })
    const summary = await getSummary(env.DB, now)
    expect(summary.security.map(i => i.externalId)).not.toContain('GHSA-aaaa-bbbb-cccc')
    expect(summary.happeningNow.map(i => i.externalId)).not.toContain('GHSA-aaaa-bbbb-cccc')
    expect((await getProviderDetail(env.DB, 'github-advisory'))?.securityAdvisories).toEqual([])
    // raw は残っている
    expect(
      (await new IncidentRepository(env.DB).get('github-advisory:GHSA-aaaa-bbbb-cccc'))?.status,
    ).toBe('withdrawn')
  })

  it('stores empty external ids as NULL', async () => {
    const empty = fakeFetch({
      'https://www.vercel-status.com/api/v2/summary.json': 'statuspage-summary.json',
      'https://www.vercel-status.com/api/v2/incidents.json': () =>
        new Response(
          JSON.stringify({
            incidents: [
              {
                id: '',
                name: 'First',
                status: 'resolved',
                impact: 'minor',
                created_at: '2026-10-22T00:00:00Z',
              },
              {
                id: '',
                name: 'Second',
                status: 'resolved',
                impact: 'minor',
                created_at: '2026-10-22T01:00:00Z',
              },
            ],
          }),
        ),
    })
    const vercel = sources.filter(s => s.id === 'vercel-status')
    const result = await runCollectors(env, ['status'], { now, fetch: empty, sources: vercel })
    expect(result.results[0]).toMatchObject({ ok: true, incidents: 2 })
  })

  it('keeps each language and severity visible when another language fills the latest page', async () => {
    const recent = Array.from({ length: 35 }, (_, i) => ({
      source: 'quota-test',
      externalId: `npm-${i}`,
      kind: 'security' as const,
      title: `Recent npm advisory ${i}`,
      url: 'https://example.com/advisory',
      ecosystem: 'npm',
      severity: 'critical',
      publishedAt: now.toISOString(),
      collectedAt: now.toISOString(),
      raw: {},
    }))
    const older = ['high', 'critical'].map(severity => ({
      source: 'quota-test',
      externalId: `go-${severity}`,
      kind: 'security' as const,
      title: `Older Go ${severity}`,
      url: 'https://example.com/go',
      ecosystem: 'go',
      severity,
      publishedAt: '2026-09-01T00:00:00.000Z',
      collectedAt: now.toISOString(),
      raw: {},
    }))
    const repo = new IncidentRepository(env.DB)
    await repo.upsertMany(await Promise.all([...recent, ...older].map(toIncident)), now)
    const summary = await getSummary(env.DB, now)
    expect(
      summary.security
        .filter(i => i.source === 'quota-test' && i.ecosystem === 'go')
        .map(i => i.severity)
        .sort(),
    ).toEqual(['critical', 'high'])
    expect(summary.security.every(i => !('raw' in i))).toBe(true)
  })
  it('keeps unscored PHP releases even when newer advisories fill the global page', async () => {
    const repo = new IncidentRepository(env.DB)
    const release = await toIncident({
      source: 'php-security',
      providerId: 'php',
      externalId: 'quota-php-release',
      kind: 'security',
      title: 'PHP security release',
      url: 'https://www.php.net/releases/',
      ecosystem: 'php',
      publishedAt: '2026-09-01T00:00:00.000Z',
      collectedAt: now.toISOString(),
      raw: {},
    })
    await repo.upsertMany([release], now)
    expect(
      (await repo.list({ kind: 'security', limit: 30 })).items.some(i => i.id === release.id),
    ).toBe(false)
    expect((await getSummary(env.DB, now)).security.some(i => i.id === release.id)).toBe(true)
  })
})
