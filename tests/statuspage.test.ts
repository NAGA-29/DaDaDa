import { describe, expect, it } from 'vitest'
import {
  normalizeStatuspageIncident,
  normalizeStatuspageSummary,
  type StatuspageIncidents,
  type StatuspageSummary,
} from '../src/worker/adapters/statuspage'
import { cloudflareStatus } from '../src/worker/sources/cloudflare'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixtureJson } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')

describe('Statuspage adapter', () => {
  it('uses the worst component status (groups ignored)', () => {
    const status = normalizeStatuspageSummary('cloudflare', fixtureJson<StatuspageSummary>('statuspage-summary.json'), now)
    expect(status).toMatchObject({
      providerId: 'cloudflare',
      status: 'partial_outage',
      message: 'Minor Service Outage',
      checkedAt: '2026-10-23T10:30:00.000Z',
    })
    expect(status.raw).toBeDefined()
  })

  it('maps all-operational summary to operational', () => {
    const status = normalizeStatuspageSummary(
      'github',
      { status: { indicator: 'none', description: 'All Systems Operational' }, components: [{ id: 'a', name: 'Git', status: 'operational' }] },
      now,
    )
    expect(status.status).toBe('operational')
  })

  it('normalizes incidents keeping upstream impact as severity', () => {
    const [active, resolved] = fixtureJson<StatuspageIncidents>('statuspage-incidents.json').incidents.map(i =>
      normalizeStatuspageIncident('cloudflare-status', 'cloudflare', 'https://www.cloudflarestatus.com', i, now),
    )
    expect(active).toMatchObject({
      kind: 'service',
      externalId: 'inc-active-1',
      title: 'Workers API elevated errors',
      url: 'https://stspg.io/abc123',
      status: 'investigating',
      severity: 'major',
      product: 'Workers',
      description: 'We are seeing elevated 5xx errors on Workers.',
      startedAt: '2026-10-23T10:05:00.000Z',
      publishedAt: '2026-10-23T10:12:00.000Z',
    })
    expect(active!.resolvedAt).toBeUndefined()
    // タイムゾーン付きの日時は UTC に揃える
    expect(resolved).toMatchObject({
      url: 'https://www.cloudflarestatus.com/incidents/inc-old-1',
      resolvedAt: '2026-10-19T18:00:00.000Z',
      product: undefined,
    })
  })

  it('collects through the source definition', async () => {
    const context = {
      now,
      fetch: fakeFetch({
        'https://www.cloudflarestatus.com/api/v2/summary.json': 'statuspage-summary.json',
        'https://www.cloudflarestatus.com/api/v2/incidents.json': 'statuspage-incidents.json',
      }),
      env: {},
    } as SourceContext
    expect((await cloudflareStatus.collectStatus(context)).status).toBe('partial_outage')
    expect(await cloudflareStatus.collect(context)).toHaveLength(2)
  })
})
