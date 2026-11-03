import { fetchText } from '../../adapters/http'
import { parseRss, type RssItem } from '../../adapters/rss'
import type { IncidentInput } from '../../domain/incident'
import { matchesDeveloperStack } from '../../lib/developer-stack'
import { extractCves, htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource } from '../types'

export const IPA_FEED_URL = 'https://www.ipa.go.jp/security/alert-rss.rdf'

export function normalizeIpaItem(item: RssItem, now: Date): IncidentInput | undefined {
  const publishedAt = toIsoUtc(item.pubDate)
  if (!publishedAt || !item.link || !matchesDeveloperStack(item.title, item.description))
    return undefined
  let url: URL
  try {
    url = new URL(item.link)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.hostname !== 'www.ipa.go.jp' || url.username || url.password)
    return undefined
  return {
    providerId: 'ipa',
    source: 'ipa-security',
    kind: 'security',
    externalId: url.toString(),
    title: item.title,
    description: htmlToText(item.description),
    url: url.toString(),
    cves: extractCves(item.title, item.description),
    publishedAt,
    updatedAt: publishedAt,
    collectedAt: now.toISOString(),
    raw: item.raw,
  }
}

export const ipaSecurity: IncidentSource = {
  id: 'ipa-security',
  type: 'rss',
  group: 'security',
  provider: {
    id: 'ipa',
    name: 'IPA',
    category: 'security',
    homepageUrl: 'https://www.ipa.go.jp',
    supportsStatus: false,
    supportsSecurity: true,
  },
  async collect(context) {
    const xml = await fetchText(context.fetch, IPA_FEED_URL)
    if (!/<rdf:RDF\b/.test(xml)) throw new Error('Unexpected IPA RSS format')
    const notices = parseRss(xml)
      .map(item => normalizeIpaItem(item, context.now))
      .filter(item => item !== undefined)
    // IPA repeats an alert URL for each update. Keep the newest upstream date
    // so older feed entries cannot overwrite the latest stored notification.
    const latest = new Map<string, IncidentInput>()
    for (const notice of notices) {
      const previous = latest.get(notice.url)
      if (!previous || notice.publishedAt > previous.publishedAt) latest.set(notice.url, notice)
    }
    return [...latest.values()]
  },
}
