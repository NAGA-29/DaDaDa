import { fetchText } from '../../adapters/http'
import { parseRss, type RssItem } from '../../adapters/rss'
import type { IncidentInput } from '../../domain/incident'
import { extractCves, htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource } from '../types'

export const POSTGRESQL_FEED_URL = 'https://www.postgresql.org/news.rss'

export function normalizePostgresqlItem(item: RssItem, now: Date): IncidentInput | undefined {
  const publishedAt = toIsoUtc(item.pubDate)
  const description = htmlToText(item.description, 100000) ?? ''
  // The news feed includes conferences, extensions, and ordinary releases. Only
  // core version releases explicitly announcing security fixes belong here.
  if (
    !publishedAt ||
    !item.link ||
    !/^PostgreSQL \d+(?:\.\d+)*(?:(?:,\s*(?:and\s+)?|\s+and\s+)\d+(?:\.\d+)*)*\s+Released!?$/i.test(
      item.title,
    ) ||
    !(
      /\bCVE-\d{4}-\d+\b/i.test(description) ||
      /\b(?:fixes|addresses|resolves)\s+(?:(?:\d+|one|two|three|multiple|several)\s+)?security (?:vulnerabilit|issue)/i.test(
        description,
      )
    )
  )
    return undefined
  let url: URL
  try {
    url = new URL(item.link)
  } catch {
    return undefined
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'www.postgresql.org' ||
    !url.pathname.startsWith('/about/news/') ||
    url.username ||
    url.password
  )
    return undefined
  return {
    providerId: 'postgresql',
    source: 'postgresql-security',
    kind: 'security',
    externalId: url.toString(),
    title: item.title,
    description: htmlToText(item.description),
    url: url.toString(),
    product: 'PostgreSQL',
    cves: extractCves(item.title, description),
    publishedAt,
    collectedAt: now.toISOString(),
    raw: item.raw,
  }
}

export const postgresqlSecurity: IncidentSource = {
  id: 'postgresql-security',
  type: 'rss',
  group: 'security',
  provider: {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'database',
    homepageUrl: 'https://www.postgresql.org',
    supportsStatus: false,
    supportsSecurity: true,
  },
  async collect(context) {
    const xml = await fetchText(context.fetch, POSTGRESQL_FEED_URL)
    if (!/<rss\b/.test(xml)) throw new Error('Unexpected PostgreSQL RSS format')
    return parseRss(xml)
      .map(item => normalizePostgresqlItem(item, context.now))
      .filter(item => item !== undefined)
  },
}
