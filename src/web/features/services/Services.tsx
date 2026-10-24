import type {
  IncidentView,
  Provider,
  ProviderCategory,
  ProviderWithStatus,
} from '../../../shared/api'
import { IncidentRow } from '../../components/IncidentRow'
import { Link } from '../../components/Link'
import { ProviderIcon } from '../../components/ProviderIcon'
import { StatusBadge } from '../../components/StatusBadge'
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../../lib/format'

export function Services({
  services,
  notices = [],
  providers = new Map(),
}: {
  services: ProviderWithStatus[]
  notices?: IncidentView[]
  providers?: Map<string, Provider>
}) {
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
      {notices.length > 0 && (
        <div className="kev">
          <h3 className="group-title">公式の障害・メンテナンス告知</h3>
          <p className="security-result">
            対象サービスや実施日時は各告知をご確認ください。現在の稼働状態を示すものではありません。
          </p>
          <ul className="incident-list compact">
            {notices.slice(0, 5).map(notice => (
              <IncidentRow
                key={notice.id}
                incident={notice}
                provider={notice.providerId ? providers.get(notice.providerId) : undefined}
              />
            ))}
          </ul>
          {[
            ...new Set(notices.flatMap(notice => (notice.providerId ? [notice.providerId] : []))),
          ].map(id => (
            <p key={id} className="detail-links">
              <Link to={`/d/${id}`}>{providers.get(id)?.name ?? id} の告知一覧 →</Link>
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
