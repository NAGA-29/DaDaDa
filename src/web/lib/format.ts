import type { ProviderCategory } from '../../shared/api'
import type { Locale } from './messages'

/** "18 min ago" のような相対表記 (表示はローカルタイム) */
export function timeAgo(iso: string | undefined, now = Date.now(), locale: Locale = 'ja'): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (!iso) return ''
  const diffSec = Math.round((Date.parse(iso) - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day')
  return formatDate(iso, locale)
}

export function formatDate(iso: string | undefined, locale: Locale = 'ja'): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(iso: string | undefined, locale: Locale = 'ja'): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
export function humanize(value: string | undefined, locale: Locale = 'ja'): string {
  if (!value) return ''
  const labels: Record<string, string> = {
    investigating: '調査中',
    identified: '原因特定済み',
    monitoring: '経過観察中',
    active: '対応中',
    resolved: '復旧済み',
    postmortem: '事後報告',
    completed: '完了',
    scheduled: '予定',
    maintenance: 'メンテナンス中',
    in_progress: '実施中',
    critical: '緊急',
    high: '高',
    medium: '中',
    low: '低',
    minor: '軽度',
    major: '重大',
    none: '影響なし',
    unknown: '不明',
    notice: '告知',
    partial_outage: '一部障害',
    major_outage: '大規模障害',
    degraded_performance: '性能低下',
    operational: '正常稼働',
    under_maintenance: 'メンテナンス中',
  }
  if (locale === 'ja' && labels[value.toLowerCase()]) return labels[value.toLowerCase()]!
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

/** Translate known application messages; official incident prose remains verbatim. */
export function statusMessage(message: string, locale: Locale): string {
  const messages: Record<string, [string, string]> = {
    'All Systems Operational': ['すべてのシステムが正常稼働しています', 'All Systems Operational'],
    'All services available': ['すべてのサービスが利用可能です', 'All services available'],
    'No active incidents reported': [
      '発生中の障害の報告はありません',
      'No active incidents reported',
    ],
    'Status data is stale': ['稼働状況のデータが古くなっています', 'Status data is stale'],
    'Scheduled maintenance in progress': [
      '定期メンテナンスを実施中です',
      'Scheduled maintenance in progress',
    ],
    '公式RSSの公開告知を配信。現在の稼働状態は未判定です。': [
      '公式RSSの公開告知を配信。現在の稼働状態は未判定です。',
      'Public RSS notices. Current availability is unverified.',
    ],
    '公式の障害・メンテナンス告知を配信。現在の稼働状態は未判定です。': [
      '公式の障害・メンテナンス告知を配信。現在の稼働状態は未判定です。',
      'Official incident and maintenance notices. Current availability is unverified.',
    ],
  }
  const known = messages[message]
  if (known) return known[locale === 'ja' ? 0 : 1]
  const count = /^(\d+) active incidents?$/.exec(message)?.[1]
  if (count && locale === 'ja') return `${count}件の障害が発生中です`
  return message
}
