import { useI18n } from '../../lib/i18n'
import { useState } from 'react'
import { matchesEcosystem, SECURITY_ECOSYSTEMS } from '../../../shared/security'
import type { IncidentView, Provider } from '../../../shared/api'
import { IncidentRow } from '../../components/IncidentRow'

type Props = {
  advisories: IncidentView[]
  providers: Map<string, Provider>
}

export function Security({ advisories, providers }: Props) {
  const { t } = useI18n()
  const [ecosystem, setEcosystem] = useState('')
  const [severity, setSeverity] = useState('critical')
  const languageMatches = advisories.filter(i => matchesEcosystem(i, ecosystem))
  const visible = languageMatches.filter(i =>
    severity === 'all' ? ['high', 'critical'].includes(i.severity ?? '') : i.severity === severity,
  )
  const notices = languageMatches.filter(i => !i.severity || i.severity === 'unknown')

  return (
    <section className="section" aria-labelledby="security-title">
      <h2 id="security-title" className="section-title">
        {t('securityAlerts')} <span className="section-count">{visible.length}</span>
      </h2>
      <div className="security-filters">
        <label>
          {t('programmingLanguage')}
          <select value={ecosystem} onChange={event => setEcosystem(event.target.value)}>
            <option value="">{t('allLanguages')}</option>
            {SECURITY_ECOSYSTEMS.map(language => (
              <option key={language.ecosystem} value={language.ecosystem}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('severity')}
          <select value={severity} onChange={event => setSeverity(event.target.value)}>
            <option value="critical">{t('critical')}</option>
            <option value="high">{t('high')}</option>
            <option value="all">{t('highCritical')}</option>
          </select>
        </label>
      </div>
      <p className="security-result" role="status">
        {t('matchingAlerts', { count: visible.length })}
        {notices.length > 0 && (
          <>
            {' '}
            ·{' '}
            <a href="#official-security-notices">
              {t('officialNoticesLink', { count: notices.length })}
            </a>
          </>
        )}
      </p>
      {visible.length === 0 ? (
        <p className="empty">{t('noMatches')}</p>
      ) : (
        <ul className="incident-list">
          {visible.map(i => (
            <IncidentRow
              key={i.id}
              incident={i}
              provider={i.providerId ? providers.get(i.providerId) : undefined}
            />
          ))}
        </ul>
      )}

      {notices.length > 0 && (
        <div className="kev" id="official-security-notices">
          <h3 className="group-title">
            {t('releaseNotices')} <span className="group-note">{t('noSeverity')}</span>
          </h3>
          <ul className="incident-list">
            {notices.map(i => (
              <IncidentRow
                key={i.id}
                incident={i}
                provider={i.providerId ? providers.get(i.providerId) : undefined}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export function KnownExploited({ advisories }: { advisories: IncidentView[] }) {
  const { t } = useI18n()

  return (
    <section className="section" aria-labelledby="kev-title">
      <h2 id="kev-title" className="section-title">
        {t('knownExploited')} <span className="section-count">{advisories.length}</span>
      </h2>
      <p className="security-result">{t('kevScope')}</p>
      {advisories.length === 0 ? (
        <p className="empty">{t('noKnownExploited')}</p>
      ) : (
        <ul className="incident-list compact">
          {advisories.map(i => (
            <IncidentRow key={i.id} incident={i} showProvider={false} />
          ))}
        </ul>
      )}
    </section>
  )
}
