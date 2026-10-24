import type { IncidentView } from '../../shared/api'
import { ecosystemAliases, SECURITY_ECOSYSTEMS } from '../../shared/security'
import type { Incident } from '../domain/incident'
import type { IncidentRepository } from '../repositories/incident.repository'

/** Merge matching GHSA/CVE aliases, including transitive duplicates from different sources. */
export function deduplicateSecurity(items: IncidentView[]): IncidentView[] {
  const withdrawnIds = new Set(
    items.filter(i => i.status === 'withdrawn').map(i => i.externalId ?? i.id),
  )
  const groups: { item: IncidentView; aliases: Set<string> }[] = []
  for (const item of items) {
    if (withdrawnIds.has(item.externalId ?? item.id)) continue
    const aliases = new Set([
      ...(item.cves ?? []).map(c => c.toUpperCase()),
      ...(/^GHSA-/i.test(item.externalId ?? '') ? [item.externalId!.toUpperCase()] : []),
      `id:${item.id}`,
    ])
    const matches = groups.filter(g => [...aliases].some(a => g.aliases.has(a)))
    const members = [item, ...matches.map(g => g.item)]
    for (const group of matches) {
      for (const a of group.aliases) aliases.add(a)
      groups.splice(groups.indexOf(group), 1)
    }
    // Prefer a scored upstream record when an official notice has no severity.
    const rank = (i: IncidentView) =>
      i.severity === 'critical' ? 2 : i.severity === 'high' ? 1 : 0
    members.sort((a, b) => rank(b) - rank(a) || b.publishedAt.localeCompare(a.publishedAt))
    const primary = members[0]!
    groups.push({
      aliases,
      item: {
        ...primary,
        cves: [...new Set(members.flatMap(m => m.cves ?? []))],
        ecosystems: [
          ...new Set(members.flatMap(m => m.ecosystems ?? (m.ecosystem ? [m.ecosystem] : []))),
        ],
      },
    })
  }
  return groups
    .map(g => g.item)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
}

export async function getSecuritySummary(incidents: IncidentRepository): Promise<Incident[]> {
  // Give every ecosystem and severity its own quota so one busy feed cannot hide another language.
  const filters = SECURITY_ECOSYSTEMS.flatMap(language =>
    ecosystemAliases(language.ecosystem).flatMap(ecosystem => [
      { ecosystem, severity: 'critical' },
      { ecosystem, severity: 'high' },
      { ecosystem, unscored: true },
    ]),
  )
  const pages = await Promise.all([
    incidents.list({ kind: 'security', excludeSource: 'cisa-kev', limit: 30 }),
    incidents.list({ kind: 'security', status: 'withdrawn', limit: 200 }),
    ...filters.map(filter =>
      incidents.list({ kind: 'security', excludeSource: 'cisa-kev', ...filter, limit: 30 }),
    ),
  ])
  return [...new Map(pages.flatMap(p => p.items).map(i => [i.id, i])).values()]
}
