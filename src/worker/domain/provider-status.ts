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

/** 複数の状態から最も悪いものを返す。空なら operational */
export function worstStatus(values: ProviderStatusValue[]): ProviderStatusValue {
  return values.reduce<ProviderStatusValue>(
    (worst, v) => (SEVERITY_ORDER[v] > SEVERITY_ORDER[worst] ? v : worst),
    'operational',
  )
}
