export type IncidentKind = 'service' | 'security'

export type Incident = {
  id: string
  providerId?: string
  kind: IncidentKind
  source: string
  externalId?: string
  title: string
  description?: string
  url: string
  status?: string
  severity?: string
  product?: string
  ecosystem?: string
  cves?: string[]
  startedAt?: string
  publishedAt: string
  updatedAt?: string
  resolvedAt?: string
  collectedAt: string
  raw: unknown
}

/** Source 側で組み立てる値。id は normalize 時に決まる */
export type IncidentInput = Omit<Incident, 'id'>

/** 上流で「終わった」とみなされる status 値 */
export const RESOLVED_STATUSES = ['resolved', 'postmortem', 'completed'] as const

/** 上流で取り下げられたもの。raw は残すが一覧には出さない */
export const HIDDEN_STATUSES = ['withdrawn'] as const

export const HAPPENING_NOW_SECURITY_WINDOW_HOURS = 72

/**
 * Happening Now に表示するか。
 * Service: 未解決のもの / Security: 公開から 72h 以内
 */
export function isHappeningNow(
  incident: Pick<Incident, 'kind' | 'status' | 'resolvedAt' | 'publishedAt'>,
  now: Date,
): boolean {
  if (incident.kind === 'service') {
    return (
      incident.status !== 'notice' &&
      !incident.resolvedAt &&
      !RESOLVED_STATUSES.includes(incident.status as never)
    )
  }
  const windowMs = HAPPENING_NOW_SECURITY_WINDOW_HOURS * 60 * 60 * 1000
  return Date.parse(incident.publishedAt) >= now.getTime() - windowMs
}
