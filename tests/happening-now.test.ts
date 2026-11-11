import { describe, expect, it } from 'vitest'
import {
  HAPPENING_NOW_SECURITY_WINDOW_HOURS,
  isHappeningNow,
  type Incident,
} from '../src/worker/domain/incident'

const now = new Date('2026-11-10T12:00:00.000Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString()

type Candidate = Pick<Incident, 'kind' | 'status' | 'resolvedAt' | 'publishedAt'>
const service = (over: Partial<Candidate> = {}): Candidate => ({
  kind: 'service',
  publishedAt: hoursAgo(1),
  ...over,
})
const security = (over: Partial<Candidate> = {}): Candidate => ({
  kind: 'security',
  publishedAt: hoursAgo(1),
  ...over,
})

describe('isHappeningNow: service (unresolved only)', () => {
  it.each(['investigating', 'identified', 'monitoring', 'degraded', undefined])(
    'includes an unresolved incident with status %s',
    status => {
      expect(isHappeningNow(service({ status }), now)).toBe(true)
    },
  )

  it.each(['resolved', 'postmortem', 'completed'])('excludes status %s', status => {
    expect(isHappeningNow(service({ status }), now)).toBe(false)
  })

  it('excludes incidents that have a resolvedAt even if the status looks active', () => {
    expect(isHappeningNow(service({ status: 'monitoring', resolvedAt: hoursAgo(0.5) }), now)).toBe(
      false,
    )
  })

  it('excludes notices', () => {
    expect(isHappeningNow(service({ status: 'notice' }), now)).toBe(false)
  })

  it('keeps long-running unresolved incidents regardless of age', () => {
    expect(
      isHappeningNow(service({ status: 'investigating', publishedAt: hoursAgo(24 * 30) }), now),
    ).toBe(true)
  })
})

describe(`isHappeningNow: security (within ${HAPPENING_NOW_SECURITY_WINDOW_HOURS}h)`, () => {
  it('uses a 72 hour window', () => {
    expect(HAPPENING_NOW_SECURITY_WINDOW_HOURS).toBe(72)
  })

  it('includes advisories published inside the window', () => {
    expect(isHappeningNow(security({ publishedAt: hoursAgo(0) }), now)).toBe(true)
    expect(isHappeningNow(security({ publishedAt: hoursAgo(71.9) }), now)).toBe(true)
  })

  it('includes the exact boundary and excludes anything older', () => {
    expect(isHappeningNow(security({ publishedAt: hoursAgo(72) }), now)).toBe(true)
    expect(isHappeningNow(security({ publishedAt: hoursAgo(72.01) }), now)).toBe(false)
    expect(isHappeningNow(security({ publishedAt: hoursAgo(24 * 30) }), now)).toBe(false)
  })

  it('does not depend on status or resolvedAt', () => {
    expect(isHappeningNow(security({ status: 'resolved', resolvedAt: hoursAgo(1) }), now)).toBe(
      true,
    )
  })
})
