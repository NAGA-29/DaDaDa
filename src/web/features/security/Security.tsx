import type { IncidentView, Provider } from '../../../shared/api'
import { IncidentRow } from '../../components/IncidentRow'

type Props = {
  advisories: IncidentView[]
  kev: IncidentView[]
  providers: Map<string, Provider>
}

export function Security({ advisories, kev, providers }: Props) {
  return (
    <section className="section" aria-labelledby="security-title">
      <h2 id="security-title" className="section-title">
        Security alerts <span className="section-count">{advisories.length}</span>
      </h2>
      {advisories.length === 0 ? (
        <p className="empty">No advisories collected yet.</p>
      ) : (
        <ul className="incident-list">
          {advisories.map(i => (
            <IncidentRow
              key={i.id}
              incident={i}
              provider={i.providerId ? providers.get(i.providerId) : undefined}
            />
          ))}
        </ul>
      )}

      {kev.length > 0 && (
        <div className="kev">
          <h3 className="group-title">
            Known exploited <span className="group-note">CISA KEV · last 30 days</span>
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
