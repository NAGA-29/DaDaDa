import type { IncidentView, ProviderDetailResponse, SummaryResponse } from '../../shared/api'
import { HAPPENING_NOW_SECURITY_WINDOW_HOURS, type Incident } from '../domain/incident'
import { freshStatus } from '../domain/provider-status'
import { IncidentRepository } from '../repositories/incident.repository'
import { ProviderRepository } from '../repositories/provider.repository'
import { ProviderStatusRepository } from '../repositories/provider-status.repository'
import { registeredProviders } from '../sources'
import { KEV_LOOKBACK_DAYS } from '../sources/cisa-kev'
import { deduplicateSecurity, getSecuritySummary } from './security.service'
import { listProviderStatuses } from './status.service'

const KEV_SOURCE = 'cisa-kev'

export function toView({ raw: _raw, ...rest }: Incident): IncidentView {
  return rest
}

function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString()
}

export async function getSummary(db: D1Database, now = new Date()): Promise<SummaryResponse> {
  const incidents = new IncidentRepository(db)
  const [activeService, recentSecurity, security, kev, services, providers, serviceNotices] =
    await Promise.all([
      incidents.list({ kind: 'service', active: true, limit: 100 }),
      incidents.list({
        kind: 'security',
        from: hoursAgo(now, HAPPENING_NOW_SECURITY_WINDOW_HOURS),
        limit: 100,
      }),
      getSecuritySummary(incidents),
      // KEV は通常の Advisory と別枠。保存済みの行にも 30 日の期限を適用する
      incidents.list({
        kind: 'security',
        source: KEV_SOURCE,
        from: hoursAgo(now, KEV_LOOKBACK_DAYS * 24),
        limit: 20,
      }),
      listProviderStatuses(db, {}, now),
      new ProviderRepository(db).list(),
      // One provider's frequent notices must not hide another provider's latest.
      Promise.all(
        registeredProviders()
          .filter(provider => provider.supportsStatus)
          .map(provider =>
            incidents.list({
              providerId: provider.id,
              kind: 'service',
              status: 'notice',
              limit: 1,
            }),
          ),
      ),
    ])

  const isKev = (i: Incident) => i.source === KEV_SOURCE
  const happeningNow = [
    ...activeService.items,
    ...recentSecurity.items.filter(i => !isKev(i)),
  ].sort((a, b) => (b.startedAt ?? b.publishedAt).localeCompare(a.startedAt ?? a.publishedAt))

  return {
    generatedAt: now.toISOString(),
    happeningNow: deduplicateSecurity(
      [...happeningNow, ...security.filter(i => i.status === 'withdrawn')].map(toView),
    ).sort((a, b) => (b.startedAt ?? b.publishedAt).localeCompare(a.startedAt ?? a.publishedAt)),
    services,
    serviceNotices: serviceNotices
      .flatMap(page => page.items.map(toView))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    security: deduplicateSecurity(security.map(toView)),
    kev: kev.items.map(toView),
    providers,
  }
}

export async function getProviderDetail(
  db: D1Database,
  providerId: string,
  now = new Date(),
): Promise<ProviderDetailResponse | null> {
  const provider = await new ProviderRepository(db).get(providerId)
  if (!provider) return null
  const incidents = new IncidentRepository(db)
  const [currentStatus, active, recent, security, notices] = await Promise.all([
    provider.supportsStatus ? new ProviderStatusRepository(db).get(providerId) : null,
    incidents.list({ providerId, kind: 'service', active: true, limit: 50 }),
    incidents.list({ providerId, kind: 'service', active: false, limit: 30 }),
    incidents.list({ providerId, kind: 'security', limit: 30 }),
    incidents.list({ providerId, kind: 'service', status: 'notice', limit: 30 }),
  ])
  return {
    provider,
    currentStatus: currentStatus ? freshStatus(currentStatus, now) : null,
    activeIncidents: active.items.map(toView),
    recentIncidents: recent.items.map(toView),
    securityAdvisories: deduplicateSecurity(security.items.map(toView)),
    officialNotices: notices.items.map(toView),
  }
}
