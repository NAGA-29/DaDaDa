import { fetchText } from '../../adapters/http'
import { parseRss, type RssItem } from '../../adapters/rss'
import type { IncidentInput } from '../../domain/incident'
import type { ProviderStatus } from '../../domain/provider-status'
import { htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext, StatusSource } from '../types'

export const SAKURA_FEED_URL = 'https://www.sakura.ad.jp/rss/mainte.rdf'

export function normalizeSakuraNotice(item: RssItem, now: Date): IncidentInput | undefined {
  const publishedAt = toIsoUtc(item.pubDate)
  const link = item.link ?? item.guid
  if (!publishedAt || !link) return undefined
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return undefined
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    !(url.hostname === 'sakura.ad.jp' || url.hostname.endsWith('.sakura.ad.jp')) ||
    url.username ||
    url.password
  )
    return undefined
  return {
    providerId: 'sakura',
    source: 'sakura-notices',
    kind: 'service',
    status: 'notice',
    // Preserve query IDs: the official feed distinguishes notices with ?id=...
    externalId: item.guid ?? url.toString(),
    title: item.title,
    description: htmlToText(item.description),
    url: url.toString(),
    publishedAt,
    collectedAt: now.toISOString(),
    raw: item.raw,
  }
}

class SakuraNoticeSource implements IncidentSource, StatusSource {
  readonly id = 'sakura-notices'
  readonly type = 'rss'
  readonly group = 'status'
  readonly provider = {
    id: 'sakura',
    name: 'さくらインターネット',
    category: 'cloud' as const,
    homepageUrl: 'https://www.sakura.ad.jp',
    statusUrl: 'https://help.sakura.ad.jp/status/',
    supportsStatus: true,
    supportsSecurity: false,
  }

  // RSS announcements do not establish current availability or recovery status.
  async collectStatus(context: SourceContext): Promise<ProviderStatus> {
    return {
      providerId: this.provider.id,
      status: 'unverified',
      message: '公式の障害・メンテナンス告知を配信。現在の稼働状態は未判定です。',
      checkedAt: context.now.toISOString(),
    }
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const xml = await fetchText(context.fetch, SAKURA_FEED_URL)
    if (!/<rss\b/i.test(xml)) throw new Error('Unexpected Sakura RSS format')
    return parseRss(xml)
      .map(item => normalizeSakuraNotice(item, context.now))
      .filter(item => item !== undefined)
  }
}

export const sakuraNotices = new SakuraNoticeSource()
