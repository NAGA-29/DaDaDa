import type { IncidentInput } from '../../domain/incident'
import type { Provider } from '../../domain/provider'
import type { ProviderStatus } from '../../domain/provider-status'
import {
  GCP_STATUS_URL,
  MAX_GCP_INCIDENTS,
  gcpProviderStatus,
  loadGcpIncidents,
  normalizeGcpIncident,
  type GcpIncident,
} from '../google-cloud'
import type { IncidentSource, SourceContext, StatusSource } from '../types'

// Gemini API (AI Studio) のステータスページには公開の機械可読フィードが無い。
// Vertex AI の Gemini API などは Google Cloud の incidents.json に載るので、
// 影響プロダクト名に "Gemini" を含む Incident だけを抜き出して扱う。

const PROVIDER_ID = 'google-gemini'

export function isGeminiIncident(incident: GcpIncident): boolean {
  return incident.affected_products?.some(p => /gemini/i.test(p.title)) ?? false
}

class GeminiSource implements StatusSource, IncidentSource {
  readonly id = 'google-gemini-status'
  readonly type = 'api'
  readonly group = 'status'
  readonly provider: Provider = {
    id: PROVIDER_ID,
    name: 'Google Gemini',
    category: 'ai',
    homepageUrl: 'https://gemini.google.com',
    statusUrl: GCP_STATUS_URL,
    supportsStatus: true,
    supportsSecurity: false,
  }

  private async load(context: SourceContext): Promise<GcpIncident[]> {
    return (await loadGcpIncidents(context)).filter(isGeminiIncident)
  }

  async collectStatus(context: SourceContext): Promise<ProviderStatus> {
    return gcpProviderStatus(await this.load(context), context.now, PROVIDER_ID)
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const incidents = await this.load(context)
    return incidents
      .sort((a, b) => Date.parse(b.begin) - Date.parse(a.begin))
      .slice(0, MAX_GCP_INCIDENTS)
      .map(i => normalizeGcpIncident(this.id, i, context.now, PROVIDER_ID))
  }
}

export const geminiStatus = new GeminiSource()
