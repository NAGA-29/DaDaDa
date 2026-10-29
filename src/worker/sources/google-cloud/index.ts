import { fetchJson } from '../../adapters/http'
import type { IncidentInput } from '../../domain/incident'
import type { Provider } from '../../domain/provider'
import {
  worstStatus,
  type ProviderStatus,
  type ProviderStatusValue,
} from '../../domain/provider-status'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext, StatusSource } from '../types'

// https://status.cloud.google.com/incidents.json (全期間の Incident 配列)

export type GcpIncident = {
  id: string
  number?: string
  begin: string
  created?: string
  end?: string | null
  modified?: string
  external_desc: string
  uri: string
  severity?: string
  status_impact?: 'SERVICE_INFORMATION' | 'SERVICE_DISRUPTION' | 'SERVICE_OUTAGE' | string
  most_recent_update?: { status?: string; text?: string; when?: string }
  affected_products?: { title: string; id: string }[]
}

export const GCP_STATUS_URL = 'https://status.cloud.google.com'
/** 履歴として保存する件数 (新しい順) */
export const MAX_GCP_INCIDENTS = 50

const IMPACT_STATUS: Record<string, ProviderStatusValue> = {
  SERVICE_INFORMATION: 'degraded',
  SERVICE_DISRUPTION: 'partial_outage',
  SERVICE_OUTAGE: 'major_outage',
}

export function gcpProviderStatus(
  incidents: GcpIncident[],
  now: Date,
  providerId = 'google-cloud',
): ProviderStatus {
  const active = incidents.filter(i => !i.end)
  return {
    providerId,
    status: worstStatus(active.map(i => IMPACT_STATUS[i.status_impact ?? ''] ?? 'degraded')),
    message: active.length
      ? `${active.length} active incident${active.length > 1 ? 's' : ''}`
      : 'All services available',
    checkedAt: now.toISOString(),
    raw: active,
  }
}

export function normalizeGcpIncident(
  source: string,
  incident: GcpIncident,
  now: Date,
  providerId = 'google-cloud',
): IncidentInput {
  const begin = toIsoUtc(incident.begin) ?? now.toISOString()
  return {
    providerId,
    kind: 'service',
    source,
    externalId: incident.id,
    title: incident.external_desc.trim(),
    description: incident.most_recent_update?.text,
    url: `${GCP_STATUS_URL}/${incident.uri.replace(/^\//, '')}`,
    status: incident.end
      ? 'resolved'
      : (incident.most_recent_update?.status?.toLowerCase() ?? 'active'),
    severity: incident.severity,
    product: incident.affected_products?.map(p => p.title).join(', ') || undefined,
    startedAt: begin,
    publishedAt: toIsoUtc(incident.created) ?? begin,
    updatedAt: toIsoUtc(incident.modified),
    resolvedAt: toIsoUtc(incident.end),
    collectedAt: now.toISOString(),
    raw: incident,
  }
}

// Status と Incident (Google Cloud / Gemini) は同じ JSON から作るので、1 回の収集につき 1 fetch に抑える
const cache = new WeakMap<SourceContext, Promise<GcpIncident[]>>()

export function loadGcpIncidents(context: SourceContext): Promise<GcpIncident[]> {
  let pending = cache.get(context)
  if (!pending) {
    pending = fetchJson<GcpIncident[]>(context.fetch, `${GCP_STATUS_URL}/incidents.json`)
    cache.set(context, pending)
  }
  return pending
}

class GoogleCloudSource implements StatusSource, IncidentSource {
  readonly id = 'google-cloud-status'
  readonly type = 'api'
  readonly group = 'status'
  readonly provider: Provider = {
    id: 'google-cloud',
    name: 'Google Cloud',
    category: 'cloud',
    homepageUrl: 'https://cloud.google.com',
    statusUrl: GCP_STATUS_URL,
    supportsStatus: true,
    supportsSecurity: false,
  }

  async collectStatus(context: SourceContext): Promise<ProviderStatus> {
    return gcpProviderStatus(await loadGcpIncidents(context), context.now)
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const incidents = await loadGcpIncidents(context)
    return [...incidents]
      .sort((a, b) => Date.parse(b.begin) - Date.parse(a.begin))
      .slice(0, MAX_GCP_INCIDENTS)
      .map(i => normalizeGcpIncident(this.id, i, context.now))
  }
}

export const googleCloudStatus = new GoogleCloudSource()
