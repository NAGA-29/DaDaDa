import { fetchText } from '../../adapters/http'
import { parseRss, type RssItem } from '../../adapters/rss'
import type { IncidentInput } from '../../domain/incident'
import type { ProviderStatus } from '../../domain/provider-status'
import { htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext, StatusSource } from '../types'

export const AZURE_FEED_URL = 'https://azure.status.microsoft/en-us/status/feed/'

export function normalizeAzureNotice(item: RssItem, now: Date): IncidentInput | undefined {
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
    !['azure.status.microsoft', 'status.azure.com', 'rssfeed.azure.status.microsoft'].includes(
      url.hostname,
    ) ||
    url.username ||
    url.password
  )
    return undefined

  return {
    providerId: 'azure',
    source: 'azure-notices',
    kind: 'service',
    status: 'notice',
    // GUIDs may be opaque IDs. Keep them separate from the official article URL.
    externalId: item.guid ?? url.toString(),
    title: item.title,
    description: htmlToText(item.description),
    url: url.toString(),
    publishedAt,
    collectedAt: now.toISOString(),
    raw: item.raw,
  }
}

class AzureNoticeSource implements IncidentSource, StatusSource {
  readonly id = 'azure-notices'
  readonly type = 'rss'
  readonly group = 'status'
  readonly provider = {
    id: 'azure',
    name: 'Azure',
    category: 'cloud' as const,
    homepageUrl: 'https://azure.microsoft.com',
    statusUrl: 'https://azure.status.microsoft/en-us/status/',
    supportsStatus: true,
    supportsSecurity: false,
  }

  // Public notices cover only some incidents, not subscription-specific health.
  async collectStatus(context: SourceContext): Promise<ProviderStatus> {
    return {
      providerId: this.provider.id,
      status: 'unverified',
      message: '公式RSSの公開告知を配信。現在の稼働状態は未判定です。',
      checkedAt: context.now.toISOString(),
    }
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const xml = await fetchText(context.fetch, AZURE_FEED_URL)
    if (!/<rss\b/i.test(xml)) throw new Error('Unexpected Azure RSS format')
    return parseRss(xml)
      .map(item => normalizeAzureNotice(item, context.now))
      .filter(item => item !== undefined)
  }
}

export const azureNotices = new AzureNoticeSource()
