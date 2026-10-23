// Worker と Web で共有する API レスポンス型
import type { Incident, IncidentKind } from '../worker/domain/incident'
import type { Provider, ProviderCategory } from '../worker/domain/provider'
import type { ProviderStatus, ProviderStatusValue } from '../worker/domain/provider-status'

export type { IncidentKind, Provider, ProviderCategory, ProviderStatusValue }

/** 一覧系では raw を返さない */
export type IncidentView = Omit<Incident, 'raw'>
export type ProviderStatusView = Omit<ProviderStatus, 'raw'>

export type ProviderWithStatus = Provider & {
  currentStatus: ProviderStatusView | null
}

export type HealthResponse = {
  ok: true
  name: 'DaDaDa'
  time: string
}

export type StatusListResponse = {
  items: ProviderWithStatus[]
}

export type IncidentListResponse = {
  items: IncidentView[]
  nextCursor: string | null
}

export type IncidentDetailResponse = {
  incident: Incident
  provider: Provider | null
}

export type ProviderListResponse = {
  items: Provider[]
}

export type ProviderDetailResponse = {
  provider: Provider
  currentStatus: ProviderStatusView | null
  activeIncidents: IncidentView[]
  recentIncidents: IncidentView[]
  securityAdvisories: IncidentView[]
}

/** トップ画面を 1 リクエストで描画するための集約 */
export type SummaryResponse = {
  generatedAt: string
  happeningNow: IncidentView[]
  services: ProviderWithStatus[]
  security: IncidentView[]
  kev: IncidentView[]
  providers: Provider[]
}

export type ErrorResponse = {
  error: string
}
