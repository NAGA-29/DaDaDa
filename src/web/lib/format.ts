import type { ProviderCategory, ProviderStatusValue } from '../../shared/api'

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' })

/** "18 min ago" のような相対表記 (表示はローカルタイム) */
export function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return ''
  const diffSec = Math.round((Date.parse(iso) - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day')
  return formatDate(iso)
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const STATUS_LABEL: Record<ProviderStatusValue, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  partial_outage: 'Partial outage',
  major_outage: 'Major outage',
  maintenance: 'Maintenance',
  unknown: 'Unknown',
}

export const CATEGORY_LABEL: Record<ProviderCategory, string> = {
  cloud: 'Cloud & Infrastructure',
  developer: 'Developer Tools',
  database: 'Database',
  ai: 'AI',
  security: 'Security',
  communication: 'Communication',
  payment: 'Payment',
  runtime: 'Runtime',
  other: 'Other',
}

export const CATEGORY_ORDER: ProviderCategory[] = [
  'cloud',
  'developer',
  'database',
  'ai',
  'communication',
  'payment',
  'runtime',
  'security',
  'other',
]

/** 上流の status 文字列 ("partial_outage", "investigating" ...) を読みやすくする */
export function humanize(value: string | undefined): string {
  if (!value) return ''
  const s = value.replace(/[_-]+/g, ' ').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function hostOf(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
