import { useState } from 'react'
import { matchesEcosystem, SECURITY_ECOSYSTEMS } from '../../../shared/security'
import type { IncidentView, Provider } from '../../../shared/api'
import { IncidentRow } from '../../components/IncidentRow'

type Props = {
  advisories: IncidentView[]
  kev: IncidentView[]
  providers: Map<string, Provider>
}

export function Security({ advisories, kev, providers }: Props) {
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
        Security alerts <span className="section-count">{visible.length}</span>
      </h2>
      <div className="security-filters">
        <label>
          Language
          <select value={ecosystem} onChange={event => setEcosystem(event.target.value)}>
            <option value="">All languages</option>
            {SECURITY_ECOSYSTEMS.map(language => (
              <option key={language.ecosystem} value={language.ecosystem}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select value={severity} onChange={event => setSeverity(event.target.value)}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="all">High + Critical</option>
          </select>
        </label>
      </div>
      <p className="security-result" role="status">
        {visible.length} matching alerts
        {notices.length > 0 && (
          <>
            {' '}
            · <a href="#official-security-notices">Official notices ({notices.length}) ↓</a>
          </>
        )}
      </p>
      {visible.length === 0 ? (
        <p className="empty">No alerts match these filters.</p>
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
            Official release &amp; security notices{' '}
            <span className="group-note">Severity not supplied</span>
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
      {kev.length > 0 && (
        <div className="kev">
          <h3 className="group-title">
            Known exploited{' '}
            <span className="group-note">CISA KEV · all languages · last 30 days</span>
          </h3>
          <ul className="incident-list compact">
            {kev.map(i => (
              <IncidentRow key={i.id} incident={i} showProvider={false} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
