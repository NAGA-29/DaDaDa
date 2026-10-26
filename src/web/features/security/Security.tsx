import { useState } from 'react'
import type { IncidentView, Provider } from '../../../shared/api'
import { SECURITY_ECOSYSTEMS } from '../../../shared/security'
import { IncidentRow } from '../../components/IncidentRow'
import { useI18n } from '../../lib/i18n'

export function SecurityFilters({
  ecosystem,
  severity,
  onEcosystemChange,
  onSeverityChange,
}: {
  ecosystem: string
  severity: string
  onEcosystemChange: (value: string) => void
  onSeverityChange?: (value: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="security-filters">
      <label>
        {t('programmingLanguage')}
        <select value={ecosystem} onChange={event => onEcosystemChange(event.target.value)}>
          <option value="">{t('allLanguages')}</option>
          {SECURITY_ECOSYSTEMS.map(language => (
            <option key={language.ecosystem} value={language.ecosystem}>
              {language.label}
            </option>
          ))}
        </select>
      </label>
      {onSeverityChange && (
        <label>
          {t('severity')}
          <select value={severity} onChange={event => onSeverityChange(event.target.value)}>
            <option value="critical">{t('critical')}</option>
            <option value="high">{t('high')}</option>
            <option value="all">{t('highCritical')}</option>
          </select>
        </label>
      )}
    </div>
  )
}

export function Feed({
  incidents,
  providers,
  empty,
}: {
  incidents: IncidentView[]
  providers: Map<string, Provider>
  empty: string
}) {
  const { t } = useI18n()
  const [limit, setLimit] = useState(4)
  const visible = incidents.slice(0, limit)
  return (
    <>
      <p className="security-result" role="status">
        {t('showingResults', { total: incidents.length, count: visible.length })}
      </p>
      {visible.length === 0 ? (
        <p className="empty feed-empty">{empty}</p>
      ) : (
        <ul className="incident-list overview-feed">
          {visible.map(i => (
            <IncidentRow
              key={i.id}
              incident={i}
              provider={i.providerId ? providers.get(i.providerId) : undefined}
              variant="feed"
            />
          ))}
        </ul>
      )}
      {limit < incidents.length && (
        <button className="load-more" type="button" onClick={() => setLimit(value => value + 12)}>
          {t('showMore', { count: Math.min(12, incidents.length - limit) })}
        </button>
      )}
    </>
  )
}
