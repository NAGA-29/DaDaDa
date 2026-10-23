import type { IncidentView, ProviderDetailResponse, SummaryResponse } from '../../shared/api'
import { HAPPENING_NOW_SECURITY_WINDOW_HOURS, type Incident } from '../domain/incident'
import { IncidentRepository } from '../repositories/incident.repository'
import { ProviderRepository } from '../repositories/provider.repository'
import { ProviderStatusRepository } from '../repositories/provider-status.repository'
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
  const [activeService, recentSecurity, security, services, providers] = await Promise.all([
    incidents.list({ kind: 'service', active: true, limit: 100 }),
    incidents.list({ kind: 'security', from: hoursAgo(now, HAPPENING_NOW_SECURITY_WINDOW_HOURS), limit: 100 }),
    incidents.list({ kind: 'security', limit: 100 }),
    listProviderStatuses(db),
    new ProviderRepository(db).list(),
  ])

  // KEV は通常の Advisory と別枠で扱う
  const isKev = (i: Incident) => i.source === KEV_SOURCE
  const happeningNow = [...activeService.items, ...recentSecurity.items.filter(i => !isKev(i))].sort((a, b) =>
    (b.startedAt ?? b.publishedAt).localeCompare(a.startedAt ?? a.publishedAt),
  )

  return {
    generatedAt: now.toISOString(),
    happeningNow: happeningNow.map(toView),
    services,
    security: security.items.filter(i => !isKev(i)).slice(0, 30).map(toView),
    kev: security.items.filter(isKev).slice(0, 20).map(toView),
    providers,
  }
}

export async function getProviderDetail(db: D1Database, providerId: string): Promise<ProviderDetailResponse | null> {
  const provider = await new ProviderRepository(db).get(providerId)
  if (!provider) return null
  const incidents = new IncidentRepository(db)
  const [currentStatus, active, recent, security] = await Promise.all([
    provider.supportsStatus ? new ProviderStatusRepository(db).get(providerId) : null,
    incidents.list({ providerId, kind: 'service', active: true, limit: 50 }),
    incidents.list({ providerId, kind: 'service', active: false, limit: 30 }),
    incidents.list({ providerId, kind: 'security', limit: 30 }),
  ])
  return {
    provider,
    currentStatus,
    activeIncidents: active.items.map(toView),
    recentIncidents: recent.items.map(toView),
    securityAdvisories: security.items.map(toView),
  }
}
