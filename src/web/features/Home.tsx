import { useI18n } from '../lib/i18n'
import { useMemo } from 'react'
import type { SummaryResponse } from '../../shared/api'
import type { Loadable } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { HappeningNow } from './happening-now/HappeningNow'
import { KnownExploited, Security } from './security/Security'
import { Services } from './services/Services'

export function Home({ summary }: { summary: Loadable<SummaryResponse> }) {
  const { locale, t } = useI18n()
  const { data, error, loading } = summary
  const providers = useMemo(() => new Map((data?.providers ?? []).map(p => [p.id, p])), [data])

  if (!data) {
    return (
      <main className="page">
        <p className="empty">{loading ? t('scanning') : error ? t('apiError') : null}</p>
      </main>
    )
  }

  const serviceIncidents = data.happeningNow.filter(i => i.kind === 'service')
  const serviceNow = serviceIncidents.length
  const securityNow = data.happeningNow.length - serviceNow

  return (
    <main className="page">
      <div className="hero">
        <h1 className="hero-title">{t('hero')}</h1>
        <p className="hero-counts">
          <span className={serviceNow ? 'count hot' : 'count'}>
            <strong>{serviceNow}</strong> {t('incidentCount')}
          </span>
          <span className={securityNow ? 'count warm' : 'count'}>
            <strong>{securityNow}</strong> {t('advisoryCount')}
          </span>
        </p>
      </div>
      {error && (
        <p className="stale" role="status">
          {t('stale', { time: formatDateTime(data.generatedAt, locale) })}
        </p>
      )}
      <div className="dashboard-columns">
        <section
          className="dashboard-column"
          aria-label={t('incidentPane')}
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
          aria-label={t('securityPane')}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: this pane must support keyboard scrolling.
          tabIndex={0}
        >
          <Security advisories={data.security} providers={providers} />
        </section>
        <section
          className="dashboard-column dashboard-column-kev"
          aria-label={t('knownExploited')}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: this pane must support keyboard scrolling.
          tabIndex={0}
        >
          <KnownExploited advisories={data.kev} />
        </section>
      </div>
    </main>
  )
}
