import { fetchJson } from '../../adapters/http'
import {
  StatuspageAdapter,
  normalizeStatuspageSummary,
  type StatuspageSummary,
  type StatuspageIncident,
} from '../../adapters/statuspage'
import { RESOLVED_STATUSES } from '../../domain/incident'
import {
  worstStatus,
  type ProviderStatus,
  type ProviderStatusValue,
} from '../../domain/provider-status'
import type { SourceContext } from '../types'

export const SUPABASE_STATUS_URL = 'https://status.supabase.com'

type SupabaseSummary = StatuspageSummary & { incidents: StatuspageIncident[] }
const IMPACT_STATUS: Record<string, ProviderStatusValue> = {
  none: 'operational',
  minor: 'degraded',
  major: 'partial_outage',
  critical: 'major_outage',
  maintenance: 'maintenance',
}

class SupabaseSource extends StatuspageAdapter {
  // incident.io's compatibility API can report indicator=none while an incident
  // remains open. Include the upstream incident impact when aggregating status.
  override async collectStatus(context: SourceContext): Promise<ProviderStatus> {
    const summary = await fetchJson<SupabaseSummary>(
      context.fetch,
      `${SUPABASE_STATUS_URL}/api/v2/summary.json`,
    )
    if (!Array.isArray(summary.incidents)) throw new Error('Unexpected Supabase summary format')
    const status = normalizeStatuspageSummary(this.provider.id, summary, context.now)
    const active = summary.incidents.filter(
      i => !i.resolved_at && !RESOLVED_STATUSES.includes(i.status as never),
    )
    return {
      ...status,
      status: worstStatus([
        status.status,
        ...active.map(i => IMPACT_STATUS[i.impact] ?? 'unknown'),
      ]),
      message: active.length ? active.map(i => i.name).join('; ') : status.message,
    }
  }
}

export const supabaseStatus = new SupabaseSource({
  provider: {
    id: 'supabase',
    name: 'Supabase',
    category: 'cloud',
    homepageUrl: 'https://supabase.com',
    statusUrl: SUPABASE_STATUS_URL,
    supportsStatus: true,
    supportsSecurity: false,
  },
  baseUrl: SUPABASE_STATUS_URL,
})
