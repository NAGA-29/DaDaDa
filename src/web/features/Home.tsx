import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { SummaryResponse } from '../../shared/api'
import { matchesEcosystem } from '../../shared/security'
import { Link, ExternalLink } from '../components/Link'
import { Pill } from '../components/StatusBadge'
import { useI18n } from '../lib/i18n'
import type { Loadable } from '../lib/api'
import { formatDateTime, humanize } from '../lib/format'
import { incidentTone } from '../lib/tone'
import { Feed, SecurityFilters } from './security/Security'
import { Services } from './services/Services'

const TABS = ['security', 'notices', 'kev'] as const
type Tab = (typeof TABS)[number]

export function Home({ summary }: { summary: Loadable<SummaryResponse> }) {
  const { locale, t } = useI18n()
  const [tab, setTab] = useState<Tab>('security')
  const [ecosystem, setEcosystem] = useState('')
  const [severity, setSeverity] = useState('critical')
  const { data, error, loading } = summary
  const providers = useMemo(() => new Map((data?.providers ?? []).map(p => [p.id, p])), [data])

  if (!data) {
    return (
      <main className="page">
        <p className="empty" role="status">
          {loading ? t('scanning') : t('apiError')}
        </p>
        {error && (
          <button className="text-button" type="button" onClick={summary.reload}>
            {t('retry')}
          </button>
        )}
      </main>
    )
  }

  const incidents = data.happeningNow.filter(i => i.kind === 'service')
  const alerts = data.security
    .filter(i => matchesEcosystem(i, ecosystem))
    .filter(i =>
      severity === 'all'
        ? ['high', 'critical'].includes(i.severity ?? '')
        : i.severity === severity,
    )
  const latestServiceNotices = new Map(
    [...(data.serviceNotices ?? [])]
      .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
      .map(i => [i.providerId ?? i.source, i]),
  )
  const notices = [
    ...latestServiceNotices.values(),
    ...data.security.filter(
      i => (!i.severity || i.severity === 'unknown') && matchesEcosystem(i, ecosystem),
    ),
  ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const counts = { security: alerts.length, notices: notices.length, kev: data.kev.length }
  const labels = {
    security: t('securityTab'),
    notices: t('officialNotices'),
    kev: t('exploitedTab'),
  }
  const icons = { security: 'shield', notices: 'notices', kev: 'bug' }
  const visible = tab === 'security' ? alerts : tab === 'notices' ? notices : data.kev

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = TABS.length - 1
    else return
    event.preventDefault()
    setTab(TABS[next]!)
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus()
  }

  return (
    <main className="page dashboard">
      <div className="hero">
        <h1 className="hero-title">{t('dashboardTitle')}</h1>
        <p className="hero-description">{t('dashboardDescription')}</p>
      </div>
      {error && (
        <p className="stale" role="status">
          {t('stale', { time: formatDateTime(data.generatedAt, locale) })}
        </p>
      )}
      <div className="dashboard-layout">
        <div className="dashboard-main">
          <section
            className={`incident-highlight${incidents.length ? '' : ' is-clear'}`}
            aria-label={t('currentIncidents')}
          >
            {incidents.length > 0 ? (
              <>
                <img
                  className="highlight-icon"
                  src="/icons/alert.svg"
                  alt=""
                  width="42"
                  height="42"
                />
                <div className="highlight-body">
                  <p className="highlight-label">
                    {t('activeIncidentCount', { count: incidents.length })}
                  </p>
                  {incidents.map(i => (
                    <div className="highlight-item" key={i.id}>
                      <h2>
                        {i.providerId && providers.get(i.providerId)?.name}
                        {i.providerId && providers.has(i.providerId) ? ' · ' : ''}
                        {i.title}
                      </h2>
                      <div className="highlight-meta">
                        <Pill tone={incidentTone(i)}>
                          {humanize(i.status, locale) || t('currentIncidents')}
                        </Pill>
                        <time dateTime={i.collectedAt}>
                          {t('collected', { time: formatDateTime(i.collectedAt, locale) })}
                        </time>
                      </div>
                      {i.providerId ? (
                        <Link className="highlight-link" to={`/d/${i.providerId}`}>
                          {t('incidentDetails')}
                          <img src="/icons/arrow.svg" alt="" width="20" height="20" />
                        </Link>
                      ) : (
                        <ExternalLink href={i.url} className="highlight-link">
                          {t('officialInformation')}
                        </ExternalLink>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div>
                <p className="highlight-label">{t('currentIncidents')}</p>
                <h2>{t('noActive')}</h2>
                <p className="muted">{t('noActiveScope')}</p>
              </div>
            )}
          </section>
          <div className="feed-tabs" role="tablist" aria-label={t('informationType')}>
            {TABS.map((value, index) => (
              <button
                type="button"
                role="tab"
                id={`tab-${value}`}
                aria-controls={`panel-${value}`}
                aria-selected={tab === value}
                tabIndex={tab === value ? 0 : -1}
                key={value}
                onClick={() => setTab(value)}
                onKeyDown={event => handleTabKey(event, index)}
              >
                <img src={`/icons/${icons[value]}.svg`} alt="" width="22" height="22" />
                <span>{labels[value]}</span>
                <span className="tab-count">{counts[value]}</span>
              </button>
            ))}
          </div>
          {TABS.map(value => (
            <section
              role="tabpanel"
              id={`panel-${value}`}
              aria-labelledby={`tab-${value}`}
              hidden={tab !== value}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tab panels must be keyboard focusable.
              tabIndex={0}
              key={value}
              className="feed-panel"
            >
              {tab === value && (
                <>
                  <p className="feed-scope">
                    {t(
                      tab === 'kev'
                        ? 'exploitedScope'
                        : tab === 'security'
                          ? 'securityScope'
                          : 'noticesScope',
                    )}
                  </p>
                  {tab !== 'kev' && (
                    <SecurityFilters
                      ecosystem={ecosystem}
                      severity={severity}
                      onEcosystemChange={setEcosystem}
                      onSeverityChange={tab === 'security' ? setSeverity : undefined}
                    />
                  )}
                  <Feed
                    key={`${tab}:${ecosystem}:${severity}`}
                    incidents={visible}
                    providers={providers}
                    empty={t(tab === 'kev' ? 'noKnownExploited' : 'noMatches')}
                  />
                </>
              )}
            </section>
          ))}
        </div>
        <Services services={data.services} />
      </div>
    </main>
  )
}
