import type { IncidentInput } from '../../domain/incident'
import type { Provider } from '../../domain/provider'
import {
  worstStatus,
  type ProviderStatus,
  type ProviderStatusValue,
} from '../../domain/provider-status'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext, StatusSource } from '../../sources/types'
import { fetchJson } from '../http'

// Atlassian Statuspage 互換 API (https://<page>/api/v2/*.json)

export type StatuspageComponent = {
  id: string
  name: string
  status:
    | 'operational'
    | 'degraded_performance'
    | 'partial_outage'
    | 'major_outage'
    | 'under_maintenance'
    | string
  group?: boolean
  only_show_if_degraded?: boolean
}

export type StatuspageIncidentUpdate = {
  id: string
  status: string
  body: string
  created_at: string
}

export type StatuspageIncident = {
  id: string
  name: string
  status: string
  impact: string
  shortlink?: string
  created_at: string
  started_at?: string
  updated_at?: string
  resolved_at?: string | null
  incident_updates?: StatuspageIncidentUpdate[]
  components?: Pick<StatuspageComponent, 'id' | 'name'>[]
}

export type StatuspageSummary = {
  status: {
    indicator: 'none' | 'minor' | 'major' | 'critical' | 'maintenance' | string
    description: string
  }
  components?: StatuspageComponent[]
}

export type StatuspageIncidents = {
  incidents: StatuspageIncident[]
}

const COMPONENT_STATUS: Record<string, ProviderStatusValue> = {
  operational: 'operational',
  degraded_performance: 'degraded',
  partial_outage: 'partial_outage',
  major_outage: 'major_outage',
  under_maintenance: 'maintenance',
}

const INDICATOR_STATUS: Record<string, ProviderStatusValue> = {
  none: 'operational',
  minor: 'degraded',
  major: 'partial_outage',
  critical: 'major_outage',
  maintenance: 'maintenance',
}

export function normalizeStatuspageSummary(
  providerId: string,
  summary: StatuspageSummary,
  now: Date,
): ProviderStatus {
  const components = (summary.components ?? []).filter(c => !c.group)
  const fromComponents = components.map(c => COMPONENT_STATUS[c.status] ?? 'unknown')
  const fromIndicator = INDICATOR_STATUS[summary.status.indicator] ?? 'unknown'
  return {
    providerId,
    status: worstStatus([fromIndicator, ...fromComponents]),
    message: summary.status.description,
    checkedAt: now.toISOString(),
    raw: summary,
  }
}

export function normalizeStatuspageIncident(
  source: string,
  providerId: string,
  baseUrl: string,
  incident: StatuspageIncident,
  now: Date,
): IncidentInput {
  const latest = incident.incident_updates?.[0]
  const createdAt = toIsoUtc(incident.created_at) ?? now.toISOString()
  return {
    providerId,
    kind: 'service',
    source,
    externalId: incident.id,
    title: incident.name,
    description: latest?.body,
    url: incident.shortlink ?? `${baseUrl}/incidents/${incident.id}`,
    status: incident.status,
    // 上流の impact (none/minor/major/critical) をそのまま保持する
    severity: incident.impact,
    product: incident.components?.map(c => c.name).join(', ') || undefined,
    startedAt: toIsoUtc(incident.started_at) ?? createdAt,
    publishedAt: createdAt,
    updatedAt: toIsoUtc(incident.updated_at),
    resolvedAt: toIsoUtc(incident.resolved_at),
    collectedAt: now.toISOString(),
    raw: incident,
  }
}

export type StatuspageAdapterOptions = {
  provider: Provider
  baseUrl: string
}

export class StatuspageAdapter implements StatusSource, IncidentSource {
  readonly type = 'api'
  readonly group = 'status'
  readonly id: string
  readonly provider: Provider
  private readonly baseUrl: string

  constructor(options: StatuspageAdapterOptions) {
    this.provider = options.provider
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.id = `${options.provider.id}-status`
  }

  async collectStatus(context: SourceContext): Promise<ProviderStatus> {
    const summary = await fetchJson<StatuspageSummary>(
      context.fetch,
      `${this.baseUrl}/api/v2/summary.json`,
    )
    return normalizeStatuspageSummary(this.provider.id, summary, context.now)
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const data = await fetchJson<StatuspageIncidents>(
      context.fetch,
      `${this.baseUrl}/api/v2/incidents.json`,
    )
    return data.incidents.map(i =>
      normalizeStatuspageIncident(this.id, this.provider.id, this.baseUrl, i, context.now),
    )
  }
}
