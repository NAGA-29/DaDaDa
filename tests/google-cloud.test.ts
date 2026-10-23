import { describe, expect, it } from 'vitest'
import { gcpProviderStatus, normalizeGcpIncident, type GcpIncident } from '../src/worker/sources/google-cloud'
import { fixtureJson } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')
const incidents = fixtureJson<GcpIncident[]>('gcp-incidents.json')

describe('Google Cloud source', () => {
  it('derives status from active incidents only', () => {
    expect(gcpProviderStatus(incidents, now)).toMatchObject({ status: 'partial_outage', message: '1 active incident' })
    expect(gcpProviderStatus(incidents.filter(i => i.end), now).status).toBe('operational')
  })

  it('normalizes incidents', () => {
    const [active, old] = incidents.map(i => normalizeGcpIncident('google-cloud-status', i, now))
    expect(active).toMatchObject({
      title: 'Cloud Run: elevated latency in us-central1',
      url: 'https://status.cloud.google.com/incidents/gcpActive1',
      status: 'service_disruption',
      product: 'Cloud Run',
      publishedAt: '2026-10-23T09:10:00.000Z',
    })
    expect(active!.resolvedAt).toBeUndefined()
    expect(old).toMatchObject({ status: 'resolved', resolvedAt: '2026-10-01T02:00:00.000Z', publishedAt: '2026-10-01T00:00:00.000Z' })
  })
})
