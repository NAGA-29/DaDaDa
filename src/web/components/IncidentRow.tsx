import { useI18n } from '../lib/i18n'
import type { IncidentView, Provider } from '../../shared/api'
import { formatDateTime, humanize, timeAgo } from '../lib/format'
import { incidentTone } from '../lib/tone'
import { ExternalLink, Link } from './Link'
import { ProviderIcon } from './ProviderIcon'
import { Dot, Pill } from './StatusBadge'

type Props = {
  incident: IncidentView
  provider?: Provider
  /** Provider 名を出すか (Provider 詳細ページでは不要) */
  showProvider?: boolean
  variant?: 'default' | 'feed'
}

export function IncidentRow({
  incident,
  provider,
  showProvider = true,
  variant = 'default',
}: Props) {
  const { locale, t } = useI18n()
  const tone = incidentTone(incident)
  const active = incident.kind === 'service' && incident.status !== 'notice' && !incident.resolvedAt
  const meta = [
    incident.product,
    incident.kind === 'service' && incident.status !== 'notice'
      ? humanize(incident.status, locale)
      : undefined,
  ].filter(Boolean)

  return (
    <li className={`incident tone-${tone}${variant === 'feed' ? ' feed-row' : ''}`}>
      <span className="incident-mark">
        {variant !== 'feed' && showProvider && provider ? (
          <ProviderIcon provider={provider} />
        ) : (
          <Dot tone={tone} pulse={active} />
        )}
      </span>
      <div className="incident-body">
        {variant !== 'feed' && showProvider && provider && (
          <Link to={`/d/${provider.id}`} className="incident-provider">
            {provider.name}
          </Link>
        )}
        <ExternalLink href={incident.url} className="incident-title">
          {incident.title}
        </ExternalLink>
        <div className="incident-meta">
          {incident.status === 'notice' && <Pill tone={tone}>{t('notice')}</Pill>}
          {incident.severity && <Pill tone={tone}>{humanize(incident.severity, locale)}</Pill>}
          {variant === 'feed' && provider && <Link to={`/d/${provider.id}`}>{provider.name}</Link>}
          {meta.length > 0 && <span>{meta.join(' · ')}</span>}
          {incident.cves?.slice(0, 3).map(cve => (
            <code key={cve} className="cve">
              {cve}
            </code>
          ))}
          {(incident.cves?.length ?? 0) > 3 && <span>+{incident.cves!.length - 3}</span>}
          {variant !== 'feed' && (
            <time
              dateTime={incident.collectedAt}
              title={new Date(incident.collectedAt).toLocaleString(locale, {
                timeZoneName: 'short',
              })}
            >
              {t('collected', { time: formatDateTime(incident.collectedAt, locale) })}
            </time>
          )}
        </div>
      </div>
      <div className="incident-side">
        <time className="incident-time" dateTime={incident.startedAt ?? incident.publishedAt}>
          {timeAgo(incident.startedAt ?? incident.publishedAt, Date.now(), locale)}
        </time>
        {variant === 'feed' && (
          <time className="collected-time" dateTime={incident.collectedAt}>
            {t('collected', { time: formatDateTime(incident.collectedAt, locale) })}
          </time>
        )}
        {variant === 'feed' && (
          <ExternalLink href={incident.url} className="official-link">
            {t('officialInformation')}
            <img src="/icons/external.svg" width="16" height="16" alt="" />
          </ExternalLink>
        )}
      </div>
    </li>
  )
}
