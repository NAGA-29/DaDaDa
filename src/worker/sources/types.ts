import type { IncidentInput } from '../domain/incident'
import type { Provider } from '../domain/provider'
import type { ProviderStatus } from '../domain/provider-status'

export type SourceType = 'rss' | 'atom' | 'api' | 'webhook' | 'provider_event' | 'scrape'

export type SourceContext = {
  now: Date
  db: D1Database
  fetch: typeof fetch
  env: {
    GITHUB_TOKEN?: string
  }
}

/** 収集グループ。Cron の間隔ごとに分ける */
export type SourceGroup = 'status' | 'security'

type SourceBase = {
  readonly id: string
  readonly type: SourceType
  readonly group: SourceGroup
  readonly provider: Provider
}

export interface IncidentSource extends SourceBase {
  collect(context: SourceContext): Promise<IncidentInput[]>
}

export interface StatusSource extends SourceBase {
  collectStatus(context: SourceContext): Promise<ProviderStatus>
}

export type Source = IncidentSource | StatusSource | (IncidentSource & StatusSource)

export function isIncidentSource(source: Source): source is IncidentSource {
  return 'collect' in source
}

export function isStatusSource(source: Source): source is StatusSource {
  return 'collectStatus' in source
}
