import { expect, test } from '@playwright/test'
import type {
  IncidentDetailResponse,
  IncidentListResponse,
  ProviderDetailResponse,
  ProviderListResponse,
  StatusListResponse,
  SummaryResponse,
} from '../src/shared/api'

const ids = (items: { id: string }[]) => items.map(i => i.id)

test.describe('API', () => {
  test('API-01 health', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, name: 'DaDaDa' })
    expect(new Date(body.time).toISOString()).toBe(body.time)
  })

  test('API-02 summary is cacheable for 30 seconds', async ({ request }) => {
    const res = await request.get('/api/summary')
    expect(res.status()).toBe(200)
    expect(res.headers()['cache-control']).toBe('public, max-age=30')
  })

  test.describe('summary', () => {
    let summary: SummaryResponse
    test.beforeAll(async ({ request }) => {
      summary = await (await request.get('/api/summary')).json()
    })

    test('API-03 happeningNow lists only unresolved service incidents', () => {
      const service = summary.happeningNow.filter(i => i.kind === 'service')
      expect(ids(service).sort()).toEqual(['cloudflare:e2e-active', 'e2e-orphan:orphan-1'])
    })

    test('API-04 security hides withdrawn, merges duplicates and excludes KEV', () => {
      const securityIds = ids(summary.security)
      expect(securityIds).not.toContain('github-advisory:GHSA-e2e0-wdrn-0001')
      expect(securityIds).not.toContain('jpcert-security:e2e-dup')
      expect(summary.security.some(i => i.source === 'cisa-kev')).toBe(false)
      const merged = summary.security.find(i => i.id === 'github-advisory:GHSA-e2e0-crit-0001')
      expect(merged?.severity).toBe('critical')
      expect(merged?.cves).toEqual(['CVE-2026-10001'])
      expect(securityIds).toContain('nodejs-security:e2e-release')
      expect(summary.security.every(i => !('raw' in i))).toBe(true)
    })

    test('API-05 kev keeps only the last 30 days', () => {
      expect(ids(summary.kev)).toEqual(['cisa-kev:CVE-2026-20001'])
    })

    test('API-06 serviceNotices keeps the latest notice per provider', () => {
      expect(ids(summary.serviceNotices ?? [])).toEqual(['sakura-notices:e2e-new'])
    })
  })

  test('API-07 status lists status providers with freshness applied', async ({ request }) => {
    const { items }: StatusListResponse = await (await request.get('/api/status')).json()
    const byId = Object.fromEntries(items.map(p => [p.id, p.currentStatus]))
    expect(Object.keys(byId).sort()).toEqual([
      'cloudflare',
      'github',
      'netlify',
      'sakura',
      'vercel',
    ])
    expect(byId.cloudflare?.status).toBe('major_outage')
    expect(byId.github?.status).toBe('operational')
    expect(byId.vercel).toMatchObject({ status: 'unknown', message: 'Status data is stale' })
    expect(byId.sakura?.status).toBe('unverified')
    expect(byId.netlify).toBeNull()
  })

  test('API-08 status filters by category and status', async ({ request }) => {
    const developer: StatusListResponse = await (
      await request.get('/api/status?category=developer')
    ).json()
    expect(ids(developer.items)).toEqual(['github'])
    const unknown: StatusListResponse = await (
      await request.get('/api/status?status=unknown')
    ).json()
    expect(ids(unknown.items).sort()).toEqual(['netlify', 'vercel'])
  })

  test('API-09 incidents list omits raw and is sorted by publishedAt desc', async ({ request }) => {
    const { items }: IncidentListResponse = await (
      await request.get('/api/incidents?limit=200')
    ).json()
    expect(items.length).toBeGreaterThan(0)
    expect(items.every(i => !('raw' in i))).toBe(true)
    const published = items.map(i => i.publishedAt)
    expect(published).toEqual([...published].sort().reverse())
  })

  test('API-10 invalid kind is rejected', async ({ request }) => {
    const res = await request.get('/api/incidents?kind=bogus')
    expect(res.status()).toBe(400)
    expect(await res.json()).toEqual({ error: 'kind must be one of service, security' })
  })

  test('API-11 incidents filter by kind, provider, ecosystem and active', async ({ request }) => {
    const list = async (query: string): Promise<string[]> =>
      ids(
        ((await (await request.get(`/api/incidents?${query}`)).json()) as IncidentListResponse)
          .items,
      )

    expect((await list('kind=service&active=true')).sort()).toEqual([
      'cloudflare:e2e-active',
      'e2e-orphan:orphan-1',
    ])
    expect(await list('kind=service&active=false')).toEqual(['cloudflare:e2e-resolved'])
    expect(await list('provider=sakura')).toEqual([
      'sakura-notices:e2e-new',
      'sakura-notices:e2e-old',
    ])
    expect(await list('kind=security&ecosystem=pip')).toEqual([
      'github-advisory:GHSA-e2e0-high-0001',
    ])
    expect(await list('kind=service&status=notice')).toHaveLength(2)
  })

  test('API-12 incidents filter by from/to', async ({ request }) => {
    const now = Date.now()
    const from = new Date(now - 3.5 * 60 * 60 * 1000).toISOString()
    const to = new Date(now - 1.5 * 60 * 60 * 1000).toISOString()
    const { items }: IncidentListResponse = await (
      await request.get(`/api/incidents?kind=security&from=${from}&to=${to}`)
    ).json()
    expect(ids(items)).toEqual([
      'github-advisory:GHSA-e2e0-crit-0002',
      'github-advisory:GHSA-e2e0-crit-0003',
    ])
  })

  test('API-13 cursor pagination walks every incident exactly once', async ({ request }) => {
    const all: IncidentListResponse = await (await request.get('/api/incidents?limit=200')).json()
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const query = cursor ? `limit=3&cursor=${cursor}` : 'limit=3'
      const page: IncidentListResponse = await (await request.get(`/api/incidents?${query}`)).json()
      expect(page.items.length).toBeLessThanOrEqual(3)
      seen.push(...ids(page.items))
      cursor = page.nextCursor
      pages++
    } while (cursor && pages < 50)
    expect(cursor).toBeNull()
    expect(seen).toEqual(ids(all.items))
    expect(new Set(seen).size).toBe(seen.length)
  })

  test('API-14 withdrawn advisories are returned only when requested', async ({ request }) => {
    const hidden: IncidentListResponse = await (
      await request.get('/api/incidents?kind=security&limit=200')
    ).json()
    expect(ids(hidden.items)).not.toContain('github-advisory:GHSA-e2e0-wdrn-0001')
    const withdrawn: IncidentListResponse = await (
      await request.get('/api/incidents?status=withdrawn')
    ).json()
    expect(ids(withdrawn.items)).toEqual(['github-advisory:GHSA-e2e0-wdrn-0001'])
  })

  test('API-15 incident detail includes raw and provider', async ({ request }) => {
    const res = await request.get(`/api/incidents/${encodeURIComponent('cloudflare:e2e-active')}`)
    expect(res.status()).toBe(200)
    const body: IncidentDetailResponse = await res.json()
    expect(body.incident).toMatchObject({
      title: 'E2E Cloudflare API errors',
      raw: { e2e: 'active' },
    })
    expect(body.provider?.name).toBe('Cloudflare')

    const orphan: IncidentDetailResponse = await (
      await request.get(`/api/incidents/${encodeURIComponent('e2e-orphan:orphan-1')}`)
    ).json()
    expect(orphan.provider).toBeNull()

    const missing = await request.get('/api/incidents/nope')
    expect(missing.status()).toBe(404)
    expect(await missing.json()).toEqual({ error: 'incident not found' })
  })

  test('API-16 providers are ordered by name and filterable', async ({ request }) => {
    const { items }: ProviderListResponse = await (await request.get('/api/providers')).json()
    const names = items.map(p => p.name)
    expect(names).toEqual([...names].sort())
    expect(items).toHaveLength(8)
    const security: ProviderListResponse = await (
      await request.get('/api/providers?category=security')
    ).json()
    expect(ids(security.items).sort()).toEqual(['cisa-kev', 'github-advisory'])
  })

  test('API-17 provider detail aggregates status and incidents', async ({ request }) => {
    const detail: ProviderDetailResponse = await (
      await request.get('/api/providers/cloudflare')
    ).json()
    expect(detail.provider.name).toBe('Cloudflare')
    expect(detail.currentStatus?.status).toBe('major_outage')
    expect(ids(detail.activeIncidents)).toEqual(['cloudflare:e2e-active'])
    expect(ids(detail.recentIncidents)).toEqual(['cloudflare:e2e-resolved'])
    expect(detail.securityAdvisories).toEqual([])

    const advisory: ProviderDetailResponse = await (
      await request.get('/api/providers/github-advisory')
    ).json()
    expect(advisory.currentStatus).toBeNull()
    expect(ids(advisory.securityAdvisories)).not.toContain('github-advisory:GHSA-e2e0-wdrn-0001')
    expect(advisory.securityAdvisories).toHaveLength(8)

    const missing = await request.get('/api/providers/nope')
    expect(missing.status()).toBe(404)
    expect(await missing.json()).toEqual({ error: 'provider not found' })
  })

  test('API-18 unknown API routes return JSON 404', async ({ request }) => {
    const res = await request.get('/api/does-not-exist')
    expect(res.status()).toBe(404)
    expect(await res.json()).toEqual({ error: 'not found' })
  })

  test('API-19 unknown webhook source is rejected', async ({ request }) => {
    const res = await request.post('/api/webhooks/unknown', { data: {} })
    expect(res.status()).toBe(404)
    expect(await res.json()).toEqual({ error: 'unknown webhook source' })
  })

  test('API-20 admin collect hides itself without a valid token', async ({ request }) => {
    const missing = await request.post('/api/admin/collect')
    expect(missing.status()).toBe(404)
    const wrong = await request.post('/api/admin/collect', {
      headers: { Authorization: 'Bearer wrong-token' },
    })
    expect(wrong.status()).toBe(404)
    expect(await wrong.json()).toEqual({ error: 'not found' })
  })
})
