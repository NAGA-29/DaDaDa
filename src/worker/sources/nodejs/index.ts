import { fetchText } from '../../adapters/http'
import { parseRss, type RssItem } from '../../adapters/rss'
import type { IncidentInput } from '../../domain/incident'
import type { Provider } from '../../domain/provider'
import { extractCves, htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext } from '../types'

const FEED_URL = 'https://nodejs.org/en/feed/vulnerability.xml'

export function normalizeNodeItem(source: string, item: RssItem, now: Date): IncidentInput | undefined {
  const publishedAt = toIsoUtc(item.pubDate)
  if (!publishedAt || !item.link) return undefined
  return {
    providerId: 'nodejs',
    kind: 'security',
    source,
    // guid には更新ごとに変わる "?<timestamp>" が付くため、link を ID にする
    externalId: item.link,
    title: item.title,
    description: htmlToText(item.description),
    url: item.link,
    product: 'Node.js',
    ecosystem: 'npm',
    cves: extractCves(item.title, item.description),
    publishedAt,
    collectedAt: now.toISOString(),
    raw: item.raw,
  }
}

class NodejsSecuritySource implements IncidentSource {
  readonly id = 'nodejs-security'
  readonly type = 'rss'
  readonly group = 'security'
  readonly provider: Provider = {
    id: 'nodejs',
    name: 'Node.js',
    category: 'runtime',
    homepageUrl: 'https://nodejs.org',
    supportsStatus: false,
    supportsSecurity: true,
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const items = parseRss(await fetchText(context.fetch, FEED_URL))
    return items.map(i => normalizeNodeItem(this.id, i, context.now)).filter(i => i !== undefined)
  }
}

export const nodejsSecurity = new NodejsSecuritySource()
