import { describe, expect, it } from 'vitest'
import { supabaseStatus, SUPABASE_STATUS_URL } from '../src/worker/sources/supabase'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixtureJson } from './helpers'
import type { StatuspageSummary, StatuspageIncident } from '../src/worker/adapters/statuspage'

const now = new Date('2026-10-23T10:30:00Z')
const summaryUrl = `${SUPABASE_STATUS_URL}/api/v2/summary.json`
const context = (fetcher: typeof fetch) => ({ now, env: {}, fetch: fetcher }) as SourceContext
const summary = () =>
  fixtureJson<StatuspageSummary & { incidents: StatuspageIncident[] }>('supabase-summary.json')

describe('Supabase status compatibility', () => {
  it('includes unresolved incident impact even when the summary indicator and components are operational', async () => {
    const ctx = context(fakeFetch({ [summaryUrl]: 'supabase-summary.json' }))
    expect(await supabaseStatus.collectStatus(ctx)).toMatchObject({
      providerId: 'supabase',
      status: 'degraded',
      message: 'Management API errors',
    })
  })

  it('ignores resolved incidents and uses normal summary status when no incidents remain', async () => {
    const data = summary()
    data.incidents[0]!.status = 'resolved'
    const fetcher = fakeFetch({ [summaryUrl]: () => Response.json(data) })
    expect((await supabaseStatus.collectStatus(context(fetcher))).status).toBe('operational')
    data.incidents = []
    data.status.indicator = 'critical'
    expect((await supabaseStatus.collectStatus(context(fetcher))).status).toBe('major_outage')
  })

  it('does not replace a worse component status with a smaller incident impact', async () => {
    const data = summary()
    data.components![0]!.status = 'major_outage'
    expect(
      (
        await supabaseStatus.collectStatus(
          context(fakeFetch({ [summaryUrl]: () => Response.json(data) })),
        )
      ).status,
    ).toBe('major_outage')
  })

  it('preserves recovery times and uses the official incident link', async () => {
    const incidents = await supabaseStatus.collect(
      context(
        fakeFetch({ [`${SUPABASE_STATUS_URL}/api/v2/incidents.json`]: 'supabase-incidents.json' }),
      ),
    )
    expect(incidents[0]).toMatchObject({
      status: 'monitoring',
      severity: 'minor',
      description: 'Monitoring API recovery.',
      url: 'https://status.supabase.com/incidents/supabase-active',
    })
    expect(incidents[1]?.resolvedAt).toBe('2026-10-22T10:00:00.000Z')
  })

  it('rejects missing incident data instead of silently claiming normal operation', async () => {
    await expect(
      supabaseStatus.collectStatus(
        context(
          fakeFetch({ [summaryUrl]: () => Response.json({ status: { indicator: 'none' } }) }),
        ),
      ),
    ).rejects.toThrow('Unexpected Supabase summary format')
  })
})
