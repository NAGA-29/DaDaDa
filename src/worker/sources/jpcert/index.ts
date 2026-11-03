import { fetchText } from '../../adapters/http'
import { parseRss, type RssItem } from '../../adapters/rss'
import { IncidentRepository } from '../../repositories/incident.repository'
import type { IncidentInput } from '../../domain/incident'
import { matchesDeveloperStack } from '../../lib/developer-stack'
import { extractCves, htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource } from '../types'

export const JPCERT_FEED_URL = 'https://www.jpcert.or.jp/rss/jpcert.rdf'

export function normalizeJpcertItem(
  item: RssItem,
  now: Date,
  previouslyCollected = false,
): IncidentInput | undefined {
  if (!previouslyCollected && !matchesDeveloperStack(item.title, item.description)) return undefined
  const publishedAt = toIsoUtc(item.pubDate)
  if (!publishedAt || !item.link) return undefined
  let url: URL
  try {
    url = new URL(item.link)
  } catch {
    return undefined
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'www.jpcert.or.jp' ||
    url.username ||
    url.password
  )
    return undefined
  return {
    providerId: 'jpcert',
    source: 'jpcert-security',
    kind: 'security',
    // Weekly Report shares dc:identifier across entries; the fragment identifies each topic.
    externalId: url.toString(),
    title: item.title,
    description: htmlToText(item.description),
    url: url.toString(),
    cves: extractCves(item.title, item.description),
    // The feed supplies one dc:date, including when an alert is updated.
    publishedAt,
    updatedAt: publishedAt,
    collectedAt: now.toISOString(),
    raw: item.raw,
  }
}

export const jpcertSecurity: IncidentSource = {
  id: 'jpcert-security',
  type: 'rss',
  group: 'security',
  provider: {
    id: 'jpcert',
    name: 'JPCERT/CC',
    category: 'security',
    homepageUrl: 'https://www.jpcert.or.jp',
    supportsStatus: false,
    supportsSecurity: true,
  },
  async collect(context) {
    const xml = await fetchText(context.fetch, JPCERT_FEED_URL)
    if (!/<rdf:RDF\b/.test(xml)) throw new Error('Unexpected JPCERT/CC RSS format')
    const repo = new IncidentRepository(context.db)
    const result: IncidentInput[] = []
    for (const item of parseRss(xml)) {
      // Validate the URL and date before looking up an existing, previously admitted notice.
      const candidate = normalizeJpcertItem(item, context.now, true)
      if (!candidate) continue
      if (!matchesDeveloperStack(item.title, item.description)) {
        const existing = await repo.get(`${this.id}:${candidate.externalId}`)
        if (!existing || existing.source !== this.id || existing.kind !== 'security') continue
      }
      result.push(candidate)
    }
    return result
  },
}
