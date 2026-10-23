import { fetchJson } from '../../adapters/http'
import type { IncidentInput } from '../../domain/incident'
import type { Provider } from '../../domain/provider'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext } from '../types'

// CISA Known Exploited Vulnerabilities。カタログ全体ではなく最近追加された分だけ取り込む
const FEED_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
export const KEV_LOOKBACK_DAYS = 30

export type KevVulnerability = {
  cveID: string
  vendorProject: string
  product: string
  vulnerabilityName: string
  dateAdded: string
  shortDescription: string
  requiredAction?: string
  dueDate?: string
  knownRansomwareCampaignUse?: string
  notes?: string
}

export type KevCatalog = {
  catalogVersion?: string
  dateReleased?: string
  vulnerabilities: KevVulnerability[]
}

export function normalizeKev(source: string, v: KevVulnerability, now: Date): IncidentInput {
  return {
    providerId: 'cisa-kev',
    kind: 'security',
    source,
    externalId: v.cveID,
    title: v.vulnerabilityName,
    description: v.shortDescription,
    url: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${encodeURIComponent(v.cveID)}`,
    status: 'known_exploited',
    product: `${v.vendorProject} ${v.product}`,
    cves: [v.cveID],
    publishedAt: toIsoUtc(v.dateAdded) ?? now.toISOString(),
    collectedAt: now.toISOString(),
    raw: v,
  }
}

export function recentKev(catalog: KevCatalog, now: Date, lookbackDays = KEV_LOOKBACK_DAYS): KevVulnerability[] {
  const since = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000
  return catalog.vulnerabilities.filter(v => Date.parse(v.dateAdded) >= since)
}

class CisaKevSource implements IncidentSource {
  readonly id = 'cisa-kev'
  readonly type = 'api'
  readonly group = 'security'
  readonly provider: Provider = {
    id: 'cisa-kev',
    name: 'CISA KEV',
    category: 'security',
    homepageUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    supportsStatus: false,
    supportsSecurity: true,
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const catalog = await fetchJson<KevCatalog>(context.fetch, FEED_URL)
    return recentKev(catalog, context.now).map(v => normalizeKev(this.id, v, context.now))
  }
}

export const cisaKev = new CisaKevSource()
