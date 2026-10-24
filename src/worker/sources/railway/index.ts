import { fetchJson } from '../../adapters/http'
import type { IncidentInput } from '../../domain/incident'
import {
  worstStatus,
  type ProviderStatus,
  type ProviderStatusValue,
} from '../../domain/provider-status'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext, StatusSource } from '../types'

export const RAILWAY_STATUS_URL = 'https://status.railway.com'
export const RAILWAY_API_URL = `${RAILWAY_STATUS_URL}/api/status`

type Component = { name: string; groupName?: string; impact: string }
type Update = { status?: string; message: string; createdAt: string }
export type RailwayIncident = {
  id: string
  slug: string
  title: string
  status: string
  createdAt: string
  resolvedAt?: string | null
  components: Component[]
  updates: Update[]
}
export type RailwayMaintenance = {
  id: string
  title: string
  status: string
  description?: string
  scheduledStart: string
  estimatedEnd?: string
  components: { component: { name: string; groupName?: string } }[]
  updates: Update[]
}
export type RailwayStatusData = {
  activeIncidents: RailwayIncident[]
  recentIncidents: RailwayIncident[]
  maintenances: RailwayMaintenance[]
  generatedAt: string
}

const IMPACT: Record<string, ProviderStatusValue> = {
  OPERATIONAL: 'operational',
  DEGRADED_PERFORMANCE: 'degraded',
  PARTIAL_OUTAGE: 'partial_outage',
  MAJOR_OUTAGE: 'major_outage',
  UNDER_MAINTENANCE: 'maintenance',
  TRIAGE: 'unverified',
}

function latestUpdate(updates: Update[]): Update | undefined {
  return [...updates].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
}

function product(components: { name: string; groupName?: string }[]): string | undefined {
  return (
    [...new Set(components.map(c => [c.groupName, c.name].filter(Boolean).join(' / ')))].join(
      ', ',
    ) || undefined
  )
}

export function normalizeRailwayIncident(incident: RailwayIncident, now: Date): IncidentInput {
  const publishedAt = toIsoUtc(incident.createdAt)
  if (!publishedAt || !incident.id || !/^[a-z0-9]+$/i.test(incident.slug))
    throw new Error('Unexpected Railway incident format')
  const latest = latestUpdate(incident.updates)
  const resolved = incident.status === 'RESOLVED' || !!incident.resolvedAt
  return {
    providerId: 'railway',
    source: 'railway-status',
    kind: 'service',
    externalId: incident.id,
    title: incident.title,
    description: latest?.message,
    url: `${RAILWAY_STATUS_URL}/incident/${incident.slug}`,
    status: resolved
      ? 'resolved'
      : incident.status === 'TRIAGE'
        ? 'notice'
        : incident.status.toLowerCase(),
    product: product(incident.components),
    publishedAt,
    startedAt: incident.status === 'TRIAGE' ? undefined : publishedAt,
    updatedAt: toIsoUtc(latest?.createdAt),
    resolvedAt: toIsoUtc(incident.resolvedAt),
    collectedAt: now.toISOString(),
    raw: incident,
  }
}

export function normalizeRailwayMaintenance(item: RailwayMaintenance, now: Date): IncidentInput {
  const start = toIsoUtc(item.scheduledStart)
  if (!item.id || !start) throw new Error('Unexpected Railway maintenance format')
  const latest = latestUpdate(item.updates)
  return {
    providerId: 'railway',
    source: 'railway-status',
    kind: 'service',
    externalId: `maintenance:${item.id}`,
    title: item.title,
    description: [
      latest?.message ?? item.description,
      `Start: ${start}`,
      item.estimatedEnd ? `Estimated end: ${item.estimatedEnd}` : undefined,
    ]
      .filter(Boolean)
      .join('\n'),
    url: RAILWAY_STATUS_URL,
    status:
      item.status === 'SCHEDULED'
        ? 'notice'
        : item.status === 'COMPLETED'
          ? 'completed'
          : item.status === 'IN_PROGRESS'
            ? 'maintenance'
            : 'notice',
    product: product(item.components.map(c => c.component)),
    publishedAt:
      toIsoUtc(
        [...item.updates].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0]
          ?.createdAt,
      ) ?? start,
    startedAt: item.status === 'IN_PROGRESS' || item.status === 'COMPLETED' ? start : undefined,
    updatedAt: toIsoUtc(latest?.createdAt),
    // estimatedEnd is not proof of completion.
    collectedAt: now.toISOString(),
    raw: item,
  }
}

export function railwayProviderStatus(data: RailwayStatusData): ProviderStatus {
  const active = data.activeIncidents.filter(i => i.status !== 'RESOLVED' && !i.resolvedAt)
  const values: ProviderStatusValue[] = active.map(i =>
    i.status === 'TRIAGE'
      ? 'unverified'
      : i.components.length
        ? worstStatus(i.components.map(c => IMPACT[c.impact] ?? 'unknown'))
        : 'unknown',
  )
  if (data.maintenances.some(m => m.status === 'IN_PROGRESS')) values.push('maintenance')
  return {
    providerId: 'railway',
    status: worstStatus(values),
    message: active.length
      ? active.map(i => i.title).join('; ')
      : values.includes('maintenance')
        ? 'Scheduled maintenance in progress'
        : 'No active incidents reported',
    checkedAt: toIsoUtc(data.generatedAt)!,
    raw: {
      activeIncidents: active,
      maintenances: data.maintenances,
      generatedAt: data.generatedAt,
    },
  }
}

class RailwaySource implements IncidentSource, StatusSource {
  readonly id = 'railway-status'
  readonly type = 'api'
  readonly group = 'status'
  readonly provider = {
    id: 'railway',
    name: 'Railway',
    category: 'cloud' as const,
    homepageUrl: 'https://railway.com',
    statusUrl: RAILWAY_STATUS_URL,
    supportsStatus: true,
    supportsSecurity: false,
  }

  private readonly cache = new WeakMap<SourceContext, Promise<RailwayStatusData>>()

  private load(context: SourceContext): Promise<RailwayStatusData> {
    let pending = this.cache.get(context)
    if (!pending) {
      pending = fetchJson<RailwayStatusData>(context.fetch, RAILWAY_API_URL).then(data => {
        if (
          !data ||
          !Array.isArray(data.activeIncidents) ||
          !Array.isArray(data.recentIncidents) ||
          !Array.isArray(data.maintenances) ||
          !toIsoUtc(data.generatedAt)
        )
          throw new Error('Unexpected Railway status format')
        return data
      })
      this.cache.set(context, pending)
    }
    return pending
  }

  async collectStatus(context: SourceContext): Promise<ProviderStatus> {
    return railwayProviderStatus(await this.load(context))
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const data = await this.load(context)
    // The two lists overlap. Prefer the active copy and retain all active events.
    const incidents = new Map(
      [...data.recentIncidents.slice(0, 50), ...data.activeIncidents].map(i => [i.id, i]),
    )
    return [
      ...[...incidents.values()].map(i => normalizeRailwayIncident(i, context.now)),
      ...data.maintenances.map(m => normalizeRailwayMaintenance(m, context.now)),
    ]
  }
}

export const railwayStatus = new RailwaySource()
