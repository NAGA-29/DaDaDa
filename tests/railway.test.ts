import { describe, expect, it, vi } from 'vitest'
import { freshStatus } from '../src/worker/domain/provider-status'
import { isHappeningNow } from '../src/worker/domain/incident'
import {
  normalizeRailwayIncident,
  normalizeRailwayMaintenance,
  railwayProviderStatus,
  railwayStatus,
  RAILWAY_API_URL,
  type RailwayStatusData,
  type RailwayMaintenance,
} from '../src/worker/sources/railway'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixtureJson } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')
const data = () => fixtureJson<RailwayStatusData>('railway-status.json')
const context = (fetcher = fakeFetch({ [RAILWAY_API_URL]: 'railway-status.json' })) =>
  ({ now, env: {}, fetch: fetcher }) as SourceContext

describe('Railway status', () => {
  it('shares one fetch per collection, deduplicates overlapping lists and fetches afresh next time', async () => {
    const fetcher = vi.fn(fakeFetch({ [RAILWAY_API_URL]: 'railway-status.json' }))
    const ctx = context(fetcher)
    const [status, incidents] = await Promise.all([
      railwayStatus.collectStatus(ctx),
      railwayStatus.collect(ctx),
    ])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(status.status).toBe('partial_outage')
    expect(incidents).toHaveLength(3)
    expect(incidents.find(i => i.externalId === 'railway-active')).toMatchObject({
      status: 'investigating',
      product: 'US East (Virginia, USA) / Builds',
      url: 'https://status.railway.com/incident/ACTIVE1',
      description: 'Investigating delays.',
    })
    await railwayStatus.collect(context(fetcher))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('keeps TRIAGE as a notice without asserting an outage or healthy operation', () => {
    const d = data()
    d.activeIncidents = [d.activeIncidents[1]!]
    expect(railwayProviderStatus(d).status).toBe('unverified')
    const notice = normalizeRailwayIncident(d.activeIncidents[0]!, now)
    expect(notice.status).toBe('notice')
    expect(isHappeningNow(notice, now)).toBe(false)
    expect(notice.severity).toBeUndefined()
  })

  it('keeps recovery times and chooses the latest update regardless of order', () => {
    const item = data().recentIncidents[2]!
    item.updates.reverse()
    expect(normalizeRailwayIncident(item, now)).toMatchObject({
      status: 'resolved',
      resolvedAt: '2026-10-22T10:00:00.000Z',
      description: 'Recovered.',
    })
    expect(railwayProviderStatus({ ...data(), activeIncidents: [] }).status).toBe('operational')
    item.slug = '../outside'
    expect(() => normalizeRailwayIncident(item, now)).toThrow('Unexpected Railway incident format')
  })

  it('uses upstream impact and generatedAt so stale data cannot look freshly checked', () => {
    const d = data()
    d.activeIncidents[0]!.components[0]!.impact = 'MAJOR_OUTAGE'
    expect(railwayProviderStatus(d).status).toBe('major_outage')
    d.activeIncidents = [d.activeIncidents[0]!]
    d.activeIncidents[0]!.components[0]!.impact = 'NEW_UNKNOWN_IMPACT'
    expect(railwayProviderStatus(d).status).toBe('unknown')
    d.generatedAt = '2026-10-23T08:00:00Z'
    expect(freshStatus(railwayProviderStatus(d), now).status).toBe('unknown')
  })

  it('distinguishes scheduled, in-progress and completed maintenance without using estimated end as recovery', () => {
    const maintenance: RailwayMaintenance = {
      id: 'maint-1',
      title: 'Network maintenance',
      status: 'SCHEDULED',
      scheduledStart: '2026-10-24T00:00:00Z',
      estimatedEnd: '2026-10-24T01:00:00Z',
      components: [{ component: { name: 'Networking' } }],
      updates: [],
    }
    const d = { ...data(), activeIncidents: [], maintenances: [maintenance] }
    const scheduled = normalizeRailwayMaintenance(maintenance, now)
    expect(scheduled.status).toBe('notice')
    expect(isHappeningNow(scheduled, now)).toBe(false)
    expect(
      normalizeRailwayMaintenance(maintenance, new Date(now.getTime() + 60000)).publishedAt,
    ).toBe(scheduled.publishedAt)
    maintenance.status = 'IN_PROGRESS'
    expect(railwayProviderStatus(d).status).toBe('maintenance')
    expect(normalizeRailwayMaintenance(maintenance, now)).toMatchObject({
      status: 'maintenance',
    })
    expect(normalizeRailwayMaintenance(maintenance, now).resolvedAt).toBeUndefined()
    maintenance.status = 'COMPLETED'
    expect(normalizeRailwayMaintenance(maintenance, now).status).toBe('completed')
  })

  it('rejects failed requests and unexpected JSON instead of reporting healthy', async () => {
    const failed = context(fakeFetch({}))
    await expect(railwayStatus.collectStatus(failed)).rejects.toThrow('HTTP 404')
    const malformed = context(
      fakeFetch({ [RAILWAY_API_URL]: () => Response.json({ activeIncidents: [] }) }),
    )
    await expect(railwayStatus.collectStatus(malformed)).rejects.toThrow(
      'Unexpected Railway status format',
    )
    await expect(railwayStatus.collect(malformed)).rejects.toThrow(
      'Unexpected Railway status format',
    )
  })
})
