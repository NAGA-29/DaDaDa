import { useI18n } from '../lib/i18n'
import type { ReactNode } from 'react'
import type { ProviderStatusValue } from '../../shared/api'
import { STATUS_TONE, type Tone } from '../lib/tone'

export function Dot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  return <span className={`dot tone-${tone}${pulse ? ' pulse' : ''}`} aria-hidden />
}

export function StatusBadge({ status }: { status: ProviderStatusValue | undefined }) {
  const { t } = useI18n()
  const value = status ?? 'unknown'
  const tone = STATUS_TONE[value]
  return (
    <span className={`badge tone-${tone}`}>
      <Dot tone={tone} pulse={tone !== 'ok' && tone !== 'muted'} />
      {t(`status.${value}`)}
    </span>
  )
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill tone-${tone}`}>{children}</span>
}
