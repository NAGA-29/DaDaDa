import type { IncidentView, ProviderStatusValue } from '../../shared/api'

/** 表示色の段階。上流の値をそのまま色に写すだけで、独自の重要度判定はしない */
export type Tone = 'ok' | 'info' | 'minor' | 'major' | 'critical' | 'muted'

export const STATUS_TONE: Record<ProviderStatusValue, Tone> = {
  operational: 'ok',
  maintenance: 'info',
  degraded: 'minor',
  partial_outage: 'major',
  major_outage: 'critical',
  unknown: 'muted',
}

const SEVERITY_TONE: Record<string, Tone> = {
  // Statuspage impact
  none: 'info',
  minor: 'minor',
  major: 'major',
  // GitHub Advisory / CVSS
  low: 'info',
  moderate: 'minor',
  medium: 'minor',
  high: 'major',
  critical: 'critical',
}

export function incidentTone(incident: Pick<IncidentView, 'severity' | 'kind' | 'source'>): Tone {
  if (incident.source === 'cisa-kev') return 'critical'
  const tone = incident.severity ? SEVERITY_TONE[incident.severity.toLowerCase()] : undefined
  return tone ?? (incident.kind === 'security' ? 'minor' : 'major')
}
