import type { ProviderWithStatus } from '../../../shared/api'
import { Link } from '../../components/Link'
import { ProviderIcon } from '../../components/ProviderIcon'
import { StatusBadge } from '../../components/StatusBadge'
import { CATEGORY_ORDER, formatDateTime } from '../../lib/format'
import { useI18n } from '../../lib/i18n'

const STATUS_ORDER = {
  major_outage: 0,
  partial_outage: 1,
  degraded: 2,
  maintenance: 3,
  operational: 4,
  unknown: 5,
  unverified: 6,
}

export function Services({ services }: { services: ProviderWithStatus[] }) {
  const { locale, t } = useI18n()
  const ordered = [...services].sort(
    (a, b) =>
      STATUS_ORDER[a.currentStatus?.status ?? 'unknown'] -
        STATUS_ORDER[b.currentStatus?.status ?? 'unknown'] || a.name.localeCompare(b.name, locale),
  )
  // カテゴリ順にまとめる (各カテゴリ内は深刻な順 → 名前順)
  const groups = CATEGORY_ORDER.map(category => ({
    category,
    items: ordered.filter(s => s.category === category),
  })).filter(g => g.items.length > 0)
  return (
    <aside className="services-panel" aria-labelledby="services-title">
      <h2 id="services-title">{t('serviceStatusTitle')}</h2>
      <p className="services-description">{t('serviceStatusDescription')}</p>
      {ordered.length === 0 && <p className="empty">{t('noSources')}</p>}
      {groups.map(({ category, items }) => (
        <section key={category} className="service-group" aria-labelledby={`services-${category}`}>
          <h3 id={`services-${category}`} className="service-category">
            {t(`category.${category}`)}
          </h3>
          <ul className="service-list">
            {items.map(s => (
              <li key={s.id}>
                <Link to={`/d/${s.id}`} className="service-row">
                  <ProviderIcon provider={s} size={32} />
                  <span className="service-name">{s.name}</span>
                  <span className="service-state">
                    <StatusBadge status={s.currentStatus?.status} />
                    <span className="service-note">
                      {s.currentStatus?.status === 'unverified'
                        ? t('noticeOnly')
                        : s.currentStatus?.status === 'unknown' || !s.currentStatus
                          ? t('statusUnavailable')
                          : t('checked', {
                              time: formatDateTime(s.currentStatus.checkedAt, locale),
                            })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="status-legend">
        <p>{t('unverifiedLegend')}</p>
        <p>{t('unknownLegend')}</p>
      </div>
    </aside>
  )
}
