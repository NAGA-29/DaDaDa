import { useI18n } from '../../lib/i18n'
import type { IncidentView, Provider } from '../../../shared/api'
import { IncidentRow } from '../../components/IncidentRow'

export function HappeningNow({
  incidents,
  notices = [],
  providers,
}: {
  incidents: IncidentView[]
  notices?: IncidentView[]
  providers: Map<string, Provider>
}) {
  const { t } = useI18n()
  // Keep the overview balanced when a provider publishes many similar notices.
  const latestNotices = new Map<string, IncidentView>()
  for (const notice of [...notices].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    const key = notice.providerId ?? notice.source
    if (!latestNotices.has(key)) latestNotices.set(key, notice)
  }
  const updates = [...incidents, ...latestNotices.values()].sort((a, b) =>
    (b.startedAt ?? b.publishedAt).localeCompare(a.startedAt ?? a.publishedAt),
  )

  return (
    <section className="section" aria-labelledby="now-title">
      <h2 id="now-title" className="section-title">
        {t('incidentsNotices')} <span className="section-count">{updates.length}</span>
      </h2>
      {updates.length === 0 ? (
        <p className="all-clear">
          <span className="all-clear-mark">✓</span> {t('noIncidentsNotices')}
        </p>
      ) : (
        <ul className="incident-list">
          {updates.map(i => (
            <IncidentRow
              key={i.id}
              incident={i}
              provider={i.providerId ? providers.get(i.providerId) : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
