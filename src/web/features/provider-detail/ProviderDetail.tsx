import type { IncidentView, ProviderDetailResponse } from '../../../shared/api'
import { IncidentRow } from '../../components/IncidentRow'
import { ExternalLink, Link } from '../../components/Link'
import { ProviderIcon } from '../../components/ProviderIcon'
import { StatusBadge } from '../../components/StatusBadge'
import { useApi } from '../../lib/api'
import { CATEGORY_LABEL, formatDate, hostOf, timeAgo } from '../../lib/format'

function IncidentSection({ title, incidents, empty }: { title: string; incidents: IncidentView[]; empty?: string }) {
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
  if (!incidents.length) return null
  return (
    <section className="section">
      <h2 className="section-title">Recent history</h2>
      <ul className="history">
        {incidents.map(i => (
          <li key={i.id}>
            <time dateTime={i.startedAt ?? i.publishedAt}>{formatDate(i.startedAt ?? i.publishedAt)}</time>
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
  const { data, error, loading } = useApi<ProviderDetailResponse>(`/api/providers/${encodeURIComponent(id)}`, 60_000)

  if (!data) {
    return (
      <main className="page">
        <Link to="/" className="back">← Everything</Link>
        <p className="empty">{loading ? 'Loading…' : error ? `Could not load ${id}.` : null}</p>
      </main>
    )
  }

  const { provider, currentStatus, activeIncidents, recentIncidents, securityAdvisories } = data
  return (
    <main className="page">
      <Link to="/" className="back">← Everything</Link>
      <div className="detail-head">
        <ProviderIcon provider={provider} size={48} />
        <div>
          <p className="detail-category">{CATEGORY_LABEL[provider.category]}</p>
          <h1 className="detail-name">{provider.name}</h1>
        </div>
      </div>

      {provider.supportsStatus && (
        <div className="detail-status">
          <StatusBadge status={currentStatus?.status} />
          {currentStatus?.message && <span className="detail-message">{currentStatus.message}</span>}
          {currentStatus && <span className="muted">checked {timeAgo(currentStatus.checkedAt)}</span>}
        </div>
      )}

      <p className="detail-links">
        {provider.statusUrl && (
          <>
            Official status <ExternalLink href={provider.statusUrl}>{hostOf(provider.statusUrl)}</ExternalLink>
          </>
        )}
        {!provider.statusUrl && <ExternalLink href={provider.homepageUrl}>{hostOf(provider.homepageUrl)}</ExternalLink>}
      </p>

      {provider.supportsStatus && (
        <IncidentSection title="Current incidents" incidents={activeIncidents} empty="No active incidents." />
      )}
      {provider.supportsSecurity && (
        <IncidentSection title="Security" incidents={securityAdvisories} empty="No advisories collected yet." />
      )}
      {provider.supportsStatus && <History incidents={recentIncidents} />}
    </main>
  )
}
