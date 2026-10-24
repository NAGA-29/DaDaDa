import type { IncidentView, Provider } from '../../shared/api'
import { humanize, timeAgo } from '../lib/format'
import { incidentTone } from '../lib/tone'
import { ExternalLink, Link } from './Link'
import { ProviderIcon } from './ProviderIcon'
import { Dot, Pill } from './StatusBadge'

type Props = {
  incident: IncidentView
  provider?: Provider
  /** Provider 名を出すか (Provider 詳細ページでは不要) */
  showProvider?: boolean
}

export function IncidentRow({ incident, provider, showProvider = true }: Props) {
  const tone = incidentTone(incident)
  const active = incident.kind === 'service' && incident.status !== 'notice' && !incident.resolvedAt
  const meta = [
    incident.product,
    incident.kind === 'service' && incident.status !== 'notice'
      ? humanize(incident.status)
      : undefined,
  ].filter(Boolean)

  return (
    <li className={`incident tone-${tone}`}>
      <span className="incident-mark">
        {showProvider && provider ? (
          <ProviderIcon provider={provider} />
        ) : (
          <Dot tone={tone} pulse={active} />
        )}
      </span>
      <div className="incident-body">
        {showProvider && provider && (
          <Link to={`/d/${provider.id}`} className="incident-provider">
            {provider.name}
          </Link>
        )}
        <ExternalLink href={incident.url} className="incident-title">
          {incident.title}
        </ExternalLink>
        <div className="incident-meta">
          {incident.status === 'notice' && <Pill tone={tone}>告知</Pill>}
          {incident.severity && <Pill tone={tone}>{incident.severity}</Pill>}
          {meta.length > 0 && <span>{meta.join(' · ')}</span>}
          {incident.cves?.slice(0, 3).map(cve => (
            <code key={cve} className="cve">
              {cve}
            </code>
          ))}
          {(incident.cves?.length ?? 0) > 3 && <span>+{incident.cves!.length - 3}</span>}
        </div>
      </div>
      <time className="incident-time" dateTime={incident.startedAt ?? incident.publishedAt}>
        {timeAgo(incident.startedAt ?? incident.publishedAt)}
      </time>
    </li>
  )
}
