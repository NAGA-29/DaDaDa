import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type {
  ErrorResponse,
  IncidentDetailResponse,
  IncidentListResponse,
  ProviderDetailResponse,
  ProviderListResponse,
  StatusListResponse,
  SummaryResponse,
} from '../src/shared/api'
import type { Bindings } from '../src/worker/env'
import { encodeCursor } from '../src/worker/repositories/incident.repository'
import {
  createWorkerEnv,
  getJson,
  request,
  seedIncidents,
  seedProviders,
  seedStatuses,
  type WorkerEnv,
} from './worker-env'

const HOUR = 60 * 60 * 1000
const NOW = Date.now()
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR).toISOString()

let worker: WorkerEnv
let env: Bindings

beforeAll(async () => {
  worker = await createWorkerEnv()
  env = worker.env

  await seedProviders(env, [
    { id: 'alpha', name: 'Alpha Cloud', category: 'cloud', supportsStatus: true },
    { id: 'beta', name: 'Beta DB', category: 'database', supportsStatus: true },
    { id: 'gamma', name: 'Gamma Lang', category: 'runtime', supportsSecurity: true },
  ])
  await seedStatuses(env, [
    { providerId: 'alpha', status: 'degraded', checkedAt: iso(0.1), message: 'Slow API' },
    { providerId: 'beta', status: 'operational', checkedAt: iso(0.1) },
  ])
  await seedIncidents(env, [
    // service: 未解決 / 解決済み / notice
    {
      id: 's-active',
      kind: 'service',
      providerId: 'alpha',
      status: 'investigating',
      publishedAt: iso(1),
    },
    {
      id: 's-resolved',
      kind: 'service',
      providerId: 'alpha',
      status: 'resolved',
      publishedAt: iso(2),
    },
    {
      id: 's-resolved-at',
      kind: 'service',
      providerId: 'beta',
      status: 'monitoring',
      publishedAt: iso(3),
      resolvedAt: iso(2.5),
    },
    { id: 's-notice', kind: 'service', providerId: 'beta', status: 'notice', publishedAt: iso(4) },
    // security: 72h 以内 / 範囲外 / 取り下げ
    {
      id: 'sec-new',
      kind: 'security',
      providerId: 'gamma',
      source: 'gamma-advisory',
      severity: 'critical',
      ecosystem: 'npm',
      publishedAt: iso(10),
    },
    {
      id: 'sec-old',
      kind: 'security',
      providerId: 'gamma',
      source: 'gamma-advisory',
      severity: 'high',
      ecosystem: 'pip',
      publishedAt: iso(24 * 10),
    },
    {
      id: 'sec-withdrawn',
      kind: 'security',
      providerId: 'gamma',
      source: 'gamma-advisory',
      severity: 'high',
      ecosystem: 'npm',
      status: 'withdrawn',
      publishedAt: iso(11),
    },
  ])
}, 60_000)

afterAll(async () => {
  await worker?.dispose()
})

const ids = (res: { items: { id: string }[] }) => res.items.map(i => i.id)

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const { status, body } = await getJson<{ ok: boolean; name: string }>(env, '/api/health')
    expect(status).toBe(200)
    expect(body).toMatchObject({ ok: true, name: 'DaDaDa' })
  })
})

describe('GET /api/status', () => {
  it('lists only providers that support status, with their current status', async () => {
    const { status, body } = await getJson<StatusListResponse>(env, '/api/status')
    expect(status).toBe(200)
    expect(body.items.map(p => [p.id, p.currentStatus?.status])).toEqual([
      ['alpha', 'degraded'],
      ['beta', 'operational'],
    ])
  })

  it('filters by category', async () => {
    const { body } = await getJson<StatusListResponse>(env, '/api/status?category=database')
    expect(body.items.map(p => p.id)).toEqual(['beta'])
  })

  it('filters by status', async () => {
    const { body } = await getJson<StatusListResponse>(env, '/api/status?status=degraded')
    expect(body.items.map(p => p.id)).toEqual(['alpha'])
  })

  it('returns an empty list when nothing matches', async () => {
    const { status, body } = await getJson<StatusListResponse>(
      env,
      '/api/status?category=cloud&status=major_outage',
    )
    expect(status).toBe(200)
    expect(body.items).toEqual([])
  })
})

describe('GET /api/incidents', () => {
  it('returns newest first and never exposes raw payloads', async () => {
    const res = await request(env, '/api/incidents')
    const text = await res.text()
    const body = JSON.parse(text) as IncidentListResponse
    expect(res.status).toBe(200)
    expect(ids(body)).toEqual([
      's-active',
      's-resolved',
      's-resolved-at',
      's-notice',
      'sec-new',
      'sec-old',
    ])
    expect(text).not.toContain('raw-only')
    expect(body.items[0]).not.toHaveProperty('raw')
    expect(body.nextCursor).toBeNull()
  })

  it('hides withdrawn advisories unless the status is requested explicitly', async () => {
    const all = await getJson<IncidentListResponse>(env, '/api/incidents?kind=security')
    expect(ids(all.body)).not.toContain('sec-withdrawn')
    const withdrawn = await getJson<IncidentListResponse>(env, '/api/incidents?status=withdrawn')
    expect(ids(withdrawn.body)).toEqual(['sec-withdrawn'])
  })

  it.each([
    ['kind', '?kind=security', ['sec-new', 'sec-old']],
    ['provider', '?provider=beta', ['s-resolved-at', 's-notice']],
    ['ecosystem', '?ecosystem=npm', ['sec-new']],
    ['status', '?status=resolved', ['s-resolved']],
    ['active=true', '?kind=service&active=true', ['s-active']],
    ['active=false', '?kind=service&active=false', ['s-resolved', 's-resolved-at']],
  ])('filters by %s', async (_name, query, expected) => {
    const { status, body } = await getJson<IncidentListResponse>(env, `/api/incidents${query}`)
    expect(status).toBe(200)
    expect(ids(body)).toEqual(expected)
  })

  it('filters by from / to (inclusive on published_at)', async () => {
    const from = encodeURIComponent(iso(3.5))
    const to = encodeURIComponent(iso(1.5))
    const { body } = await getJson<IncidentListResponse>(
      env,
      `/api/incidents?from=${from}&to=${to}`,
    )
    expect(ids(body)).toEqual(['s-resolved', 's-resolved-at'])
  })

  it('combines filters with AND', async () => {
    const { body } = await getJson<IncidentListResponse>(
      env,
      '/api/incidents?kind=service&provider=alpha&active=true',
    )
    expect(ids(body)).toEqual(['s-active'])
  })

  it('rejects an unknown kind with 400', async () => {
    const { status, body } = await getJson<ErrorResponse>(env, '/api/incidents?kind=bogus')
    expect(status).toBe(400)
    expect(body.error).toContain('service')
    expect(body.error).toContain('security')
  })

  describe('pagination', () => {
    it('pages through every item exactly once with limit + cursor', async () => {
      const seen: string[] = []
      let cursor: string | null = null
      let pages = 0
      do {
        const query: string = `/api/incidents?limit=2${cursor ? `&cursor=${cursor}` : ''}`
        const { body } = await getJson<IncidentListResponse>(env, query)
        seen.push(...ids(body))
        cursor = body.nextCursor
        pages++
      } while (cursor && pages < 10)
      expect(pages).toBe(3)
      expect(seen).toEqual([
        's-active',
        's-resolved',
        's-resolved-at',
        's-notice',
        'sec-new',
        'sec-old',
      ])
    })

    it('returns no nextCursor when the page is exactly the last one', async () => {
      const { body } = await getJson<IncidentListResponse>(env, '/api/incidents?limit=6')
      expect(body.items).toHaveLength(6)
      expect(body.nextCursor).toBeNull()
    })

    it('returns a nextCursor when exactly one more item remains', async () => {
      const { body } = await getJson<IncidentListResponse>(env, '/api/incidents?limit=5')
      expect(body.items).toHaveLength(5)
      expect(body.nextCursor).not.toBeNull()
      const next = await getJson<IncidentListResponse>(
        env,
        `/api/incidents?limit=5&cursor=${body.nextCursor}`,
      )
      expect(ids(next.body)).toEqual(['sec-old'])
      expect(next.body.nextCursor).toBeNull()
    })

    it('returns an empty page after the last item', async () => {
      const cursor = encodeCursor({ id: 'sec-old', publishedAt: iso(24 * 10) })
      const { body } = await getJson<IncidentListResponse>(env, `/api/incidents?cursor=${cursor}`)
      expect(body).toEqual({ items: [], nextCursor: null })
    })

    it('breaks ties on identical published_at by id', async () => {
      const publishedAt = iso(500)
      const tieIds = ['tie-a', 'tie-b', 'tie-c']
      await seedIncidents(
        env,
        tieIds.map(id => ({ id, kind: 'service' as const, status: 'resolved', publishedAt })),
      )
      try {
        const window = `from=${encodeURIComponent(publishedAt)}&to=${encodeURIComponent(publishedAt)}`
        const seen: string[] = []
        let cursor: string | null = null
        for (let page = 0; page < 5; page++) {
          const query: string = `/api/incidents?${window}&limit=1${cursor ? `&cursor=${cursor}` : ''}`
          const { body } = await getJson<IncidentListResponse>(env, query)
          seen.push(...ids(body))
          cursor = body.nextCursor
          if (!cursor) break
        }
        // published_at が同じなら id の降順。取りこぼしも重複もない
        expect(seen).toEqual(['tie-c', 'tie-b', 'tie-a'])
      } finally {
        await env.DB.prepare(
          `DELETE FROM incidents WHERE id IN (${tieIds.map(() => '?').join(',')})`,
        )
          .bind(...tieIds)
          .run()
      }
    })

    it('ignores a malformed cursor instead of failing', async () => {
      const { status, body } = await getJson<IncidentListResponse>(env, '/api/incidents?cursor=%%%')
      expect(status).toBe(200)
      expect(body.items.length).toBeGreaterThan(0)
    })

    it('clamps limit to the allowed range', async () => {
      const zero = await getJson<IncidentListResponse>(env, '/api/incidents?limit=0')
      expect(zero.body.items).toHaveLength(1)
      const negative = await getJson<IncidentListResponse>(env, '/api/incidents?limit=-5')
      expect(negative.body.items).toHaveLength(1)
      const huge = await getJson<IncidentListResponse>(env, '/api/incidents?limit=100000')
      expect(huge.status).toBe(200)
    })

    it('falls back to the default limit when limit is not a number', async () => {
      const { status, body } = await getJson<IncidentListResponse>(env, '/api/incidents?limit=abc')
      expect(status).toBe(200)
      expect(body.items.length).toBeGreaterThan(0)
    })
  })
})

describe('GET /api/incidents/:id', () => {
  it('returns the incident with raw data and its provider', async () => {
    const { status, body } = await getJson<IncidentDetailResponse>(env, '/api/incidents/s-active')
    expect(status).toBe(200)
    expect(body.incident).toMatchObject({ id: 's-active', providerId: 'alpha' })
    expect(body.incident.raw).toEqual({ secret: 'raw-only' })
    expect(body.provider).toMatchObject({ id: 'alpha', name: 'Alpha Cloud' })
  })

  it('returns 404 for an unknown id', async () => {
    const { status, body } = await getJson<ErrorResponse>(env, '/api/incidents/does-not-exist')
    expect(status).toBe(404)
    expect(body.error).toBe('incident not found')
  })
})

describe('GET /api/providers', () => {
  it('lists providers ordered by name', async () => {
    const { status, body } = await getJson<ProviderListResponse>(env, '/api/providers')
    expect(status).toBe(200)
    expect(body.items.map(p => p.id)).toEqual(['alpha', 'beta', 'gamma'])
    expect(body.items[0]).toMatchObject({ supportsStatus: true, supportsSecurity: false })
  })

  it('filters by category', async () => {
    const { body } = await getJson<ProviderListResponse>(env, '/api/providers?category=runtime')
    expect(body.items.map(p => p.id)).toEqual(['gamma'])
  })
})

describe('GET /api/providers/:id', () => {
  it('returns current status, active / recent incidents and notices', async () => {
    const { status, body } = await getJson<ProviderDetailResponse>(env, '/api/providers/alpha')
    expect(status).toBe(200)
    expect(body.provider.id).toBe('alpha')
    expect(body.currentStatus).toMatchObject({ status: 'degraded', message: 'Slow API' })
    expect(ids({ items: body.activeIncidents })).toEqual(['s-active'])
    expect(ids({ items: body.recentIncidents })).toEqual(['s-resolved'])
  })

  it('separates notices from incidents', async () => {
    const { body } = await getJson<ProviderDetailResponse>(env, '/api/providers/beta')
    expect(ids({ items: body.officialNotices ?? [] })).toEqual(['s-notice'])
    expect(ids({ items: body.activeIncidents })).toEqual([])
  })

  it('returns security advisories for security providers without a status', async () => {
    const { body } = await getJson<ProviderDetailResponse>(env, '/api/providers/gamma')
    expect(body.currentStatus).toBeNull()
    expect(ids({ items: body.securityAdvisories })).toEqual(['sec-new', 'sec-old'])
  })

  it('returns 404 for an unknown provider', async () => {
    const { status, body } = await getJson<ErrorResponse>(env, '/api/providers/nope')
    expect(status).toBe(404)
    expect(body.error).toBe('provider not found')
  })
})

describe('Happening Now (GET /api/summary)', () => {
  it('includes unresolved service incidents and security advisories within 72h', async () => {
    const { status, body } = await getJson<SummaryResponse>(env, '/api/summary')
    expect(status).toBe(200)
    const happening = ids({ items: body.happeningNow })
    expect(happening).toContain('s-active')
    expect(happening).toContain('sec-new')
  })

  it('excludes resolved service incidents, notices and advisories older than 72h', async () => {
    const { body } = await getJson<SummaryResponse>(env, '/api/summary')
    const happening = ids({ items: body.happeningNow })
    expect(happening).not.toContain('s-resolved')
    expect(happening).not.toContain('s-resolved-at')
    expect(happening).not.toContain('s-notice')
    expect(happening).not.toContain('sec-old')
  })

  it('drops withdrawn advisories and shows service notices separately', async () => {
    const { body } = await getJson<SummaryResponse>(env, '/api/summary')
    expect(ids({ items: body.happeningNow })).not.toContain('sec-withdrawn')
    expect(ids({ items: body.security })).not.toContain('sec-withdrawn')
  })

  it('is cacheable for a short period', async () => {
    const res = await request(env, '/api/summary')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=30')
  })
})

describe('error handling', () => {
  it('returns a JSON 404 for unknown API paths', async () => {
    const { status, body } = await getJson<ErrorResponse>(env, '/api/unknown')
    expect(status).toBe(404)
    expect(body.error).toBe('not found')
  })
})
