import { useI18n } from '../../lib/i18n'
import type { IncidentView, ProviderDetailResponse } from '../../../shared/api'
import { IncidentRow } from '../../components/IncidentRow'
import { ExternalLink, Link } from '../../components/Link'
import { ProviderIcon } from '../../components/ProviderIcon'
import { StatusBadge } from '../../components/StatusBadge'
import { useApi } from '../../lib/api'
import { formatDate, hostOf, statusMessage, timeAgo } from '../../lib/format'

function IncidentSection({
  title,
  incidents,
  empty,
}: {
  title: string
  incidents: IncidentView[]
  empty?: string
}) {
  if (!incidents.length && !empty) return null
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {incidents.length ? (
        <ul className="incident-list">
          {incidents.map(i => (
            <IncidentRow key={i.id} incident={i} showProvider={false} />
          ))}
        </ul>
      ) : (
        <p className="empty">{empty}</p>
      )}
    </section>
  )
}

function History({ incidents }: { incidents: IncidentView[] }) {
  const { locale, t } = useI18n()
  if (!incidents.length) return null
  return (
    <section className="section">
      <h2 className="section-title">{t('recentHistory')}</h2>
      <ul className="history">
        {incidents.map(i => (
          <li key={i.id}>
            <time dateTime={i.startedAt ?? i.publishedAt}>
              {formatDate(i.startedAt ?? i.publishedAt, locale)}
            </time>
            <a href={i.url} target="_blank" rel="noreferrer noopener">
              {i.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ProviderDetail({ id }: { id: string }) {
  const { locale, t } = useI18n()
  const { data, error, loading } = useApi<ProviderDetailResponse>(
    `/api/providers/${encodeURIComponent(id)}`,
    60_000,
  )

  if (!data) {
    return (
      <main className="page">
        <Link to="/" className="back">
          {t('back')}
        </Link>
        <p className="empty">
          {loading ? t('loading') : error ? t('loadError', { name: id }) : null}
        </p>
      </main>
    )
  }

  const { provider, currentStatus, activeIncidents, recentIncidents, securityAdvisories } = data
  const noticeOnly = currentStatus?.status === 'unverified'
  const officialNotices = data.officialNotices ?? []
  return (
    <main className="page">
      <Link to="/" className="back">
        {t('back')}
      </Link>
      <div className="detail-head">
        <ProviderIcon provider={provider} size={48} />
        <div>
          <p className="detail-category">{t(`category.${provider.category}`)}</p>
          <h1 className="detail-name">{provider.name}</h1>
        </div>
      </div>

      {provider.supportsStatus && (
        <div className="detail-status">
          <StatusBadge status={currentStatus?.status} />
          {currentStatus?.message && (
            <span className="detail-message">{statusMessage(currentStatus.message, locale)}</span>
          )}
          {currentStatus && !noticeOnly && (
            <span className="muted">
              {t('checked', { time: timeAgo(currentStatus.checkedAt, Date.now(), locale) })}
            </span>
          )}
        </div>
      )}

      <p className="detail-links">
        {provider.statusUrl && (
          <>
            {t('officialStatus')}{' '}
            <ExternalLink href={provider.statusUrl}>{hostOf(provider.statusUrl)}</ExternalLink>
          </>
        )}
        {!provider.statusUrl && (
          <ExternalLink href={provider.homepageUrl}>{hostOf(provider.homepageUrl)}</ExternalLink>
        )}
      </p>

      {provider.supportsStatus && !noticeOnly && (
        <IncidentSection
          title={t('currentIncidents')}
          incidents={activeIncidents}
          empty={t('noActive')}
        />
      )}
      {(noticeOnly || officialNotices.length > 0) && (
        <IncidentSection
          title={t('serviceNotices')}
          incidents={officialNotices}
          empty={t('noNotices')}
        />
      )}
      {provider.supportsSecurity && (
        <IncidentSection
          title={t('security')}
          incidents={securityAdvisories}
          empty={t('noAdvisories')}
        />
      )}
      {provider.supportsStatus && <History incidents={recentIncidents} />}
    </main>
  )
}
