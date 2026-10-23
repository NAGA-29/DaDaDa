import type { IncidentView, Provider } from '../../../shared/api'
import { IncidentRow } from '../../components/IncidentRow'

export function HappeningNow({ incidents, providers }: { incidents: IncidentView[]; providers: Map<string, Provider> }) {
  return (
    <section className="section" aria-labelledby="now-title">
      <h2 id="now-title" className="section-title">Happening now</h2>
      {incidents.length === 0 ? (
        <p className="all-clear">
          <span className="all-clear-mark">✓</span> Nothing is breaking right now. Ship it.
        </p>
      ) : (
        <ul className="incident-list">
          {incidents.map(i => (
            <IncidentRow key={i.id} incident={i} provider={i.providerId ? providers.get(i.providerId) : undefined} />
          ))}
        </ul>
      )}
    </section>
  )
}
