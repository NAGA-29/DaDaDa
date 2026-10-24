import { SECURITY_LANGUAGES } from '../../../shared/security'
import { parseAtom } from '../../adapters/atom'
import { fetchJson, fetchText } from '../../adapters/http'
import { parseRss, type RssItem } from '../../adapters/rss'
import type { IncidentInput } from '../../domain/incident'
import { extractCves, htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import { githubHeaders, normalizeGithubAdvisory, type GithubAdvisory } from '../github-advisory'
import { languageProvider } from '../language-advisories'
import type { IncidentSource } from '../types'

const language = (ecosystem: string) => {
  const found = SECURITY_LANGUAGES.find(l => l.ecosystem === ecosystem)
  if (!found) throw new Error(`Unsupported ecosystem: ${ecosystem}`)
  return found
}

type GoModuleIndex = { path: string; vulns: { id: string; modified: string }[] }[]
export type GoVulnerability = {
  id: string
  summary?: string
  details?: string
  published: string
  modified?: string
  withdrawn?: string
  aliases?: string[]
  affected: { package: { name: string } }[]
}

export function normalizeGoVulnerability(
  item: GoVulnerability,
  now: Date,
): IncidentInput | undefined {
  const publishedAt = toIsoUtc(item.published)
  if (!publishedAt || !item.affected.some(a => ['stdlib', 'toolchain'].includes(a.package.name)))
    return undefined
  return {
    providerId: 'go',
    source: 'go-runtime-security',
    kind: 'security',
    externalId: item.id,
    title: item.summary ?? item.id,
    description: item.details?.slice(0, 2000),
    url: `https://pkg.go.dev/vuln/${item.id}`,
    status: item.withdrawn ? 'withdrawn' : undefined,
    ecosystem: 'go',
    product: 'Go standard library / toolchain',
    cves: extractCves(...(item.aliases ?? [])),
    publishedAt,
    updatedAt: toIsoUtc(item.modified),
    collectedAt: now.toISOString(),
    raw: item,
  }
}

export const goRuntimeSecurity: IncidentSource = {
  id: 'go-runtime-security',
  type: 'api',
  group: 'security',
  provider: languageProvider(language('go')),
  async collect(context) {
    const modules = await fetchJson<GoModuleIndex>(
      context.fetch,
      'https://vuln.go.dev/index/modules.json',
    )
    const entries = modules
      .filter(m => ['stdlib', 'toolchain'].includes(m.path))
      .flatMap(m => m.vulns)
    const ids = [
      ...new Map(
        entries.sort((a, b) => b.modified.localeCompare(a.modified)).map(v => [v.id, v]),
      ).keys(),
    ].slice(0, 12)
    const results: IncidentInput[] = []
    // Bounded batches avoid opening many subrequests at once.
    for (let i = 0; i < ids.length; i += 3) {
      const batch = await Promise.all(
        ids.slice(i, i + 3).map(async id => {
          if (!/^GO-\d{4}-\d+$/.test(id)) throw new Error('Invalid Go advisory ID')
          const item = await fetchJson<GoVulnerability>(
            context.fetch,
            `https://vuln.go.dev/ID/${id}.json`,
          )
          return normalizeGoVulnerability(item, context.now)
        }),
      )
      results.push(...batch.filter(i => i !== undefined))
    }
    return results
  },
}

export const rustRuntimeSecurity: IncidentSource = {
  id: 'rust-runtime-security',
  type: 'atom',
  group: 'security',
  provider: languageProvider(language('rust')),
  async collect(context) {
    return parseAtom(await fetchText(context.fetch, 'https://blog.rust-lang.org/feed.xml')).flatMap(
      entry => {
        const publishedAt = toIsoUtc(entry.published ?? entry.updated)
        const url = entry.link
        const text = `${entry.title} ${htmlToText(entry.content ?? entry.summary, 100000) ?? ''}`
        if (!publishedAt || !url || !/^https:\/\/blog\.rust-lang\.org\//.test(url)) return []
        if (!/security advisory|security fix|security release|CVE-\d{4}-\d+/i.test(text)) return []
        return [
          {
            providerId: 'rust',
            source: this.id,
            kind: 'security',
            externalId: entry.id ?? url,
            title: entry.title,
            description: htmlToText(entry.content ?? entry.summary),
            url,
            ecosystem: 'rust',
            product: 'Rust / Cargo / rustup',
            cves: extractCves(text),
            publishedAt,
            updatedAt: toIsoUtc(entry.updated),
            collectedAt: context.now.toISOString(),
            raw: entry.raw,
          },
        ]
      },
    )
  },
}

// Java SE risk matrices are isolated before extracting CVEs: never classify every Oracle CVE as Java.
export function normalizeJavaNotice(item: RssItem, html: string, now: Date): IncidentInput[] {
  const publishedAt = toIsoUtc(item.pubDate)
  if (!publishedAt || !item.link) return []
  const matrix =
    /<!--\s*START Oracle Java SE RISK MATRIX\s*-->([\s\S]*?)<!--\s*END Oracle Java SE RISK MATRIX\s*-->/i.exec(
      html,
    )?.[1]
  if (matrix) {
    return [...matrix.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(row => {
      const cells = [...row[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        c => htmlToText(c[1]) ?? '',
      )
      const cve = extractCves(cells[0])[0]
      if (!cve || !cells[1]?.includes('Java')) return []
      return [
        {
          providerId: 'java',
          source: 'java-runtime-security',
          kind: 'security',
          externalId: `${item.link}#${cve}`,
          title: `${cve}: ${cells[2] || 'Java SE'} — ${cells[1]}`,
          description: `${item.title}. Upstream CVSS base score: ${cells[5] || 'not provided'}. Affected versions: ${cells[14] || 'See advisory'}`,
          url: `${item.link}#AppendixJAVA`,
          product: cells[1],
          ecosystem: 'maven',
          cves: [cve],
          publishedAt,
          collectedAt: now.toISOString(),
          raw: { feed: item.raw, row: row[0] },
        },
      ]
    })
  }
  // Standalone emergency alerts, unlike multi-product patch bulletins.
  if (
    !/\/alert-[^/]+\.html$/.test(item.link) ||
    !/Java SE|GraalVM/i.test(htmlToText(html, 100000) ?? '')
  )
    return []
  return [
    {
      providerId: 'java',
      source: 'java-runtime-security',
      kind: 'security',
      externalId: item.link,
      title: item.title,
      description: htmlToText(html),
      url: item.link,
      product: 'Java SE / GraalVM',
      ecosystem: 'maven',
      cves: extractCves(item.title),
      publishedAt,
      collectedAt: now.toISOString(),
      raw: { feed: item.raw, html },
    },
  ]
}

export const javaRuntimeSecurity: IncidentSource = {
  id: 'java-runtime-security',
  type: 'rss',
  group: 'security',
  provider: languageProvider(language('maven')),
  async collect(context) {
    const xml = await fetchText(
      context.fetch,
      'https://www.oracle.com/ocom/groups/public/@otn/documents/webcontent/rss-otn-sec.xml',
    )
    const items = parseRss(xml)
      .filter(item => {
        const date = toIsoUtc(item.pubDate)
        return (
          date &&
          Date.parse(date) >= context.now.getTime() - 120 * 86400000 &&
          item.link &&
          /^https:\/\/www\.oracle\.com\/security-alerts\/(?:cpu|cspu|alert-)[a-z0-9-]+\.html$/.test(
            item.link,
          )
        )
      })
      .sort((a, b) => Date.parse(b.pubDate ?? '') - Date.parse(a.pubDate ?? ''))
      .slice(0, 4)
    const result: IncidentInput[] = []
    for (const item of items) {
      result.push(
        ...normalizeJavaNotice(item, await fetchText(context.fetch, item.link!), context.now),
      )
    }
    return result
  },
}

export function dotnetSource(repository: string): IncidentSource {
  return {
    id: `dotnet-${repository}-security`,
    type: 'api',
    group: 'security',
    provider: languageProvider(language('nuget')),
    async collect(context) {
      const items = await fetchJson<GithubAdvisory[]>(
        context.fetch,
        `https://api.github.com/repos/dotnet/${repository}/security-advisories?per_page=100`,
        githubHeaders(context),
      )
      return items
        .filter(a => ['high', 'critical'].includes(a.severity) || a.withdrawn_at)
        .map(a => ({
          ...normalizeGithubAdvisory(this.id, a, context.now),
          providerId: 'dotnet',
          ecosystem: 'nuget',
        }))
    },
  }
}

export const runtimeSecuritySources = [
  goRuntimeSecurity,
  javaRuntimeSecurity,
  rustRuntimeSecurity,
  dotnetSource('runtime'),
  dotnetSource('aspnetcore'),
]
