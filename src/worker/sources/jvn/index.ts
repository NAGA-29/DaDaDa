import { fetchText } from '../../adapters/http'
import { parseRss, type RssItem } from '../../adapters/rss'
import type { IncidentInput } from '../../domain/incident'
import { matchesDeveloperStack } from '../../lib/developer-stack'
import { extractCves, htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource } from '../types'

export const JVN_FEED_URL = 'https://jvn.jp/rss/jvn.rdf'

export function normalizeJvnItem(item: RssItem, now: Date): IncidentInput | undefined {
  const publishedAt = toIsoUtc(item.pubDate)
  if (!publishedAt || !item.link || !matchesDeveloperStack(item.title, item.description))
    return undefined
  let url: URL
  try {
    url = new URL(item.link)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.hostname !== 'jvn.jp' || url.username || url.password)
    return undefined
  return {
    providerId: 'jvn',
    source: 'jvn-security',
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

export const jvnSecurity: IncidentSource = {
  id: 'jvn-security',
  type: 'rss',
  group: 'security',
  provider: {
    id: 'jvn',
    name: 'JVN',
    category: 'security',
    homepageUrl: 'https://jvn.jp',
    supportsStatus: false,
    supportsSecurity: true,
  },
  async collect(context) {
    const xml = await fetchText(context.fetch, JVN_FEED_URL)
    if (!/<rdf:RDF\b/.test(xml)) throw new Error('Unexpected JVN RSS format')
    return parseRss(xml)
      .map(item => normalizeJvnItem(item, context.now))
      .filter(item => item !== undefined)
  },
}
