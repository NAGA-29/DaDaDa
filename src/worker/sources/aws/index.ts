import { fetchText } from '../../adapters/http'
import { parseRss, type RssItem } from '../../adapters/rss'
import type { IncidentInput } from '../../domain/incident'
import type { ProviderStatus } from '../../domain/provider-status'
import { htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext, StatusSource } from '../types'

export const AWS_FEED_URL = 'https://status.aws.amazon.com/rss/all.rss'

export function normalizeAwsNotice(item: RssItem, now: Date): IncidentInput | undefined {
  const publishedAt = toIsoUtc(item.pubDate)
  const link = item.guid ?? item.link
  if (!publishedAt || !link) return undefined
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return undefined
  }
  if (
    url.protocol !== 'https:' ||
    !['status.aws.amazon.com', 'health.aws.amazon.com'].includes(url.hostname) ||
    url.username ||
    url.password
  )
    return undefined
  // The all-services feed links every item to the homepage; its GUID carries
  // the service/region and unique update ID. Unknown formats stay unlabelled.
  const scope = url.hash.match(/^#([a-z0-9]+)-([a-z]{2}(?:-[a-z]+)+-\d+|global)_\d+$/i)
  const product = scope ? `${scope[1]} · ${scope[2]}` : undefined
  return {
    providerId: 'aws',
    source: 'aws-notices',
    kind: 'service',
    status: 'notice',
    // Keep the full GUID including its fragment: link alone is not unique.
    externalId: item.guid ?? url.toString(),
    title: item.title,
    product,
    description: htmlToText(item.description),
    url: url.toString(),
    publishedAt,
    collectedAt: now.toISOString(),
    raw: item.raw,
  }
}

class AwsNoticeSource implements IncidentSource, StatusSource {
  readonly id = 'aws-notices'
  readonly type = 'rss'
  readonly group = 'status'
  readonly provider = {
    id: 'aws',
    name: 'AWS',
    category: 'cloud' as const,
    homepageUrl: 'https://aws.amazon.com',
    statusUrl: 'https://health.aws.amazon.com/health/status',
    supportsStatus: true,
    supportsSecurity: false,
  }

  // RSS announcements do not establish current availability or recovery status.
  async collectStatus(context: SourceContext): Promise<ProviderStatus> {
    return {
      providerId: this.provider.id,
      status: 'unverified',
      message: '公式RSSの公開告知を配信。現在の稼働状態は未判定です。',
      checkedAt: context.now.toISOString(),
    }
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const xml = await fetchText(context.fetch, AWS_FEED_URL)
    if (!/<rss\b/i.test(xml)) throw new Error('Unexpected AWS RSS format')
    return parseRss(xml)
      .map(item => normalizeAwsNotice(item, context.now))
      .filter(item => item !== undefined)
  }
}

export const awsNotices = new AwsNoticeSource()
