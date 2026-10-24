import { useMemo } from 'react'
import type { SummaryResponse } from '../../shared/api'
import type { Loadable } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { HappeningNow } from './happening-now/HappeningNow'
import { Security } from './security/Security'
import { Services } from './services/Services'

export function Home({ summary }: { summary: Loadable<SummaryResponse> }) {
  const { data, error, loading } = summary
  const providers = useMemo(() => new Map((data?.providers ?? []).map(p => [p.id, p])), [data])

  if (!data) {
    return (
      <main className="page">
        <p className="empty">
          {loading ? 'Scanning…' : error ? 'Could not reach the DaDaDa API.' : null}
        </p>
      </main>
    )
  }

  const serviceIncidents = data.happeningNow.filter(i => i.kind === 'service')
  const serviceNow = serviceIncidents.length
  const securityNow = data.happeningNow.length - serviceNow

  return (
    <main className="page">
      <div className="hero">
        <h1 className="hero-title">What's breaking now?</h1>
        <p className="hero-counts">
          <span className={serviceNow ? 'count hot' : 'count'}>
            <strong>{serviceNow}</strong> incident{serviceNow === 1 ? '' : 's'} now
          </span>
          <span className={securityNow ? 'count warm' : 'count'}>
            <strong>{securityNow}</strong> security advisor{securityNow === 1 ? 'y' : 'ies'}
          </span>
        </p>
      </div>
      {error && (
        <p className="stale" role="status">
          Can't reach DaDaDa right now — showing data from {formatDateTime(data.generatedAt)}.
        </p>
      )}
      <div className="dashboard-columns">
        <section
          className="dashboard-column"
          aria-label="Incidents and service status"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: this pane must support keyboard scrolling.
          tabIndex={0}
        >
          <HappeningNow
            incidents={serviceIncidents}
            notices={data.serviceNotices ?? []}
            providers={providers}
          />
          <Services services={data.services} />
        </section>
        <section
          className="dashboard-column"
          aria-label="Security alerts and known exploited vulnerabilities"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: this pane must support keyboard scrolling.
          tabIndex={0}
        >
          <Security advisories={data.security} kev={data.kev} providers={providers} />
        </section>
      </div>
    </main>
  )
}
