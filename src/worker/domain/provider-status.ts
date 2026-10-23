export type ProviderStatusValue =
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance'
  | 'unknown'

export type ProviderStatus = {
  providerId: string
  status: ProviderStatusValue
  message?: string
  checkedAt: string
  /** Source の元データ。API レスポンスには含めない */
  raw?: unknown
}

const SEVERITY_ORDER: Record<ProviderStatusValue, number> = {
  operational: 0,
  unknown: 1,
  maintenance: 2,
  degraded: 3,
  partial_outage: 4,
  major_outage: 5,
}

/** Status 収集は 5 分ごと。これより古い値は信用せず unknown として扱う */
export const STATUS_STALE_AFTER_MINUTES = 30

/** checkedAt が古すぎる (= 収集が失敗し続けている) 場合は unknown にする */
export function freshStatus<T extends ProviderStatus>(status: T, now: Date): T {
  const ageMs = now.getTime() - Date.parse(status.checkedAt)
  if (ageMs <= STATUS_STALE_AFTER_MINUTES * 60 * 1000) return status
  return { ...status, status: 'unknown', message: 'Status data is stale' }
}

/** 複数の状態から最も悪いものを返す。空なら operational */
export function worstStatus(values: ProviderStatusValue[]): ProviderStatusValue {
  return values.reduce<ProviderStatusValue>(
    (worst, v) => (SEVERITY_ORDER[v] > SEVERITY_ORDER[worst] ? v : worst),
    'operational',
  )
}
