import { fetchJson } from '../../adapters/http'
import type { IncidentInput } from '../../domain/incident'
import type { Provider } from '../../domain/provider'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext } from '../types'

// GitHub Advisory Database (reviewed のみ)。ノイズを避けるため上流 severity が critical のものに絞る
const API_URL = 'https://api.github.com/advisories?type=reviewed&severity=critical&sort=published&direction=desc&per_page=50'

export type GithubAdvisory = {
  ghsa_id: string
  cve_id: string | null
  html_url: string
  summary: string
  description?: string | null
  severity: string
  published_at: string
  updated_at?: string
  withdrawn_at?: string | null
  identifiers?: { type: string; value: string }[]
  vulnerabilities?: { package?: { ecosystem: string; name: string } | null }[]
}

export function normalizeGithubAdvisory(source: string, advisory: GithubAdvisory, now: Date): IncidentInput {
  const packages = (advisory.vulnerabilities ?? []).flatMap(v => (v.package ? [v.package] : []))
  const cves = new Set<string>()
  if (advisory.cve_id) cves.add(advisory.cve_id)
  for (const id of advisory.identifiers ?? []) if (id.type === 'CVE') cves.add(id.value)
  return {
    providerId: 'github-advisory',
    kind: 'security',
    source,
    externalId: advisory.ghsa_id,
    title: advisory.summary,
    description: advisory.description?.slice(0, 2000) ?? undefined,
    url: advisory.html_url,
    severity: advisory.severity,
    product: [...new Set(packages.map(p => p.name))].join(', ') || undefined,
    ecosystem: packages[0]?.ecosystem,
    cves: [...cves],
    publishedAt: toIsoUtc(advisory.published_at) ?? now.toISOString(),
    updatedAt: toIsoUtc(advisory.updated_at),
    collectedAt: now.toISOString(),
    raw: advisory,
  }
}

class GithubAdvisorySource implements IncidentSource {
  readonly id = 'github-advisory'
  readonly type = 'api'
  readonly group = 'security'
  readonly provider: Provider = {
    id: 'github-advisory',
    name: 'GitHub Advisory',
    category: 'security',
    homepageUrl: 'https://github.com/advisories',
    supportsStatus: false,
    supportsSecurity: true,
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (context.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${context.env.GITHUB_TOKEN}`
    const advisories = await fetchJson<GithubAdvisory[]>(context.fetch, API_URL, headers)
    return advisories.filter(a => !a.withdrawn_at).map(a => normalizeGithubAdvisory(this.id, a, context.now))
  }
}

export const githubAdvisory = new GithubAdvisorySource()
