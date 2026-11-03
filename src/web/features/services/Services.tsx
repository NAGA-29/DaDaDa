import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ProviderWithStatus } from '../../../shared/api'
import { Link } from '../../components/Link'
import { ProviderIcon } from '../../components/ProviderIcon'
import { StatusBadge } from '../../components/StatusBadge'
import { formatDateTime } from '../../lib/format'
import { useI18n } from '../../lib/i18n'

const TABS = ['cloud', 'developer', 'ai'] as const
type Tab = (typeof TABS)[number]

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
  const [tab, setTab] = useState<Tab>('cloud')
  const ordered = [...services].sort(
    (a, b) =>
      STATUS_ORDER[a.currentStatus?.status ?? 'unknown'] -
        STATUS_ORDER[b.currentStatus?.status ?? 'unknown'] || a.name.localeCompare(b.name, locale),
  )
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
    <aside className="services-panel" aria-labelledby="services-title">
      <h2 id="services-title">{t('serviceStatusTitle')}</h2>
      <p className="services-description">{t('serviceStatusDescription')}</p>
      <div className="service-tabs" role="tablist" aria-label={t('serviceStatusTitle')}>
        {TABS.map((category, index) => (
          <button
            type="button"
            role="tab"
            id={`services-tab-${category}`}
            aria-controls={`services-panel-${category}`}
            aria-selected={tab === category}
            tabIndex={tab === category ? 0 : -1}
            key={category}
            onClick={() => setTab(category)}
            onKeyDown={event => handleTabKey(event, index)}
          >
            {t(category === 'cloud' ? 'cloudTab' : `category.${category}`)}
          </button>
        ))}
      </div>
      {TABS.map(category => (
        <section
          key={category}
          role="tabpanel"
          id={`services-panel-${category}`}
          aria-labelledby={`services-tab-${category}`}
          hidden={tab !== category}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tab panels must be keyboard focusable.
          tabIndex={0}
        >
          {tab === category &&
            (ordered.some(s => s.category === category) ? (
              <ul className="service-list">
                {ordered
                  .filter(s => s.category === category)
                  .map(s => (
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
            ) : (
              <p className="empty">{t('noSources')}</p>
            ))}
        </section>
      ))}
      <div className="status-legend">
        <p>{t('unverifiedLegend')}</p>
        <p>{t('unknownLegend')}</p>
      </div>
    </aside>
  )
}
