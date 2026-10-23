import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { runCollectors } from '../src/worker/collectors/collector-runner'
import type { Bindings } from '../src/worker/env'
import { IncidentRepository } from '../src/worker/repositories/incident.repository'
import { getProviderDetail, getSummary } from '../src/worker/services/incident.service'
import { sources } from '../src/worker/sources'
import { fakeFetch } from './helpers'

// wrangler のローカル D1 (インメモリ) に migration を当てて、収集〜API 集約まで通す
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Bindings>>>
let env: Bindings

const now = new Date('2026-10-23T10:30:00Z')

const fetcher = fakeFetch({
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
    expect(byId['vercel-status']).toMatchObject({ ok: false, error: 'network down' })
    expect(byId['cloudflare-status']).toMatchObject({ ok: true, incidents: 2, status: 'partial_outage' })
    expect(byId['google-cloud-status']).toMatchObject({ ok: true, incidents: 2, status: 'partial_outage' })
    expect(byId['php-security']).toMatchObject({ ok: true, incidents: 1 })
    expect(byId['github-advisory']).toMatchObject({ ok: true, incidents: 1 })
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

    const services = Object.fromEntries(summary.services.map(s => [s.id, s.currentStatus?.status ?? null]))
    expect(services).toEqual({ cloudflare: 'partial_outage', github: null, 'google-cloud': 'partial_outage', vercel: null })
  })

  it('returns provider detail', async () => {
    const detail = await getProviderDetail(env.DB, 'cloudflare')
    expect(detail?.activeIncidents.map(i => i.title)).toEqual(['Workers API elevated errors'])
    expect(detail?.recentIncidents.map(i => i.title)).toEqual(['R2 latency'])

    const php = await getProviderDetail(env.DB, 'php')
    expect(php?.currentStatus).toBeNull()
    expect(php?.securityAdvisories).toHaveLength(1)
  })
})
