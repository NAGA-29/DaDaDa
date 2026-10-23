import type { ProviderCategory, ProviderWithStatus } from '../../../shared/api'
import { Link } from '../../components/Link'
import { ProviderIcon } from '../../components/ProviderIcon'
import { StatusBadge } from '../../components/StatusBadge'
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../../lib/format'

export function Services({ services }: { services: ProviderWithStatus[] }) {
  const groups = new Map<ProviderCategory, ProviderWithStatus[]>()
  for (const s of services) groups.set(s.category, [...(groups.get(s.category) ?? []), s])
  const ordered = CATEGORY_ORDER.filter(c => groups.has(c))

  return (
    <section className="section" aria-labelledby="services-title">
      <h2 id="services-title" className="section-title">
        Services
      </h2>
      {ordered.length === 0 && <p className="empty">No status sources collected yet.</p>}
      <div className="service-groups">
        {ordered.map(category => (
          <div key={category} className="service-group">
            <h3 className="group-title">{CATEGORY_LABEL[category]}</h3>
            <ul className="service-list">
              {groups.get(category)!.map(s => (
                <li key={s.id}>
                  <Link to={`/d/${s.id}`} className="service-row">
                    <ProviderIcon provider={s} size={22} />
                    <span className="service-name">{s.name}</span>
                    <StatusBadge status={s.currentStatus?.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
