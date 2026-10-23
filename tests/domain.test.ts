import { describe, expect, it } from 'vitest'
import { canonicalUrl, incidentId, normalizeTitle } from '../src/worker/domain/fingerprint'
import { isHappeningNow } from '../src/worker/domain/incident'
import { freshStatus, worstStatus } from '../src/worker/domain/provider-status'
import { decodeEntities } from '../src/worker/lib/text'
import { decodeCursor, encodeCursor } from '../src/worker/repositories/incident.repository'

describe('incidentId', () => {
  it('uses source + externalId when available', async () => {
    expect(
      await incidentId({
        source: 'github-status',
        externalId: 'abc',
        url: 'x',
        title: 't',
        publishedAt: '2026-10-23T00:00:00Z',
      }),
    ).toBe('github-status:abc')
  })

  it('falls back to a stable fingerprint', async () => {
    const base = {
      source: 'feed',
      url: 'https://Example.com/post/?utm=1#top',
      title: '  Hello   World ',
      publishedAt: '2026-10-23T05:00:00Z',
    }
    const a = await incidentId(base)
    const b = await incidentId({
      ...base,
      url: 'https://example.com/post',
      title: 'hello world',
      publishedAt: '2026-10-23T23:00:00Z',
    })
    expect(a).toMatch(/^feed:fp:[0-9a-f]{32}$/)
    expect(a).toBe(b)
    expect(await incidentId({ ...base, title: 'other' })).not.toBe(a)
  })

  it('normalizes helpers', () => {
    expect(normalizeTitle(' A\n B ')).toBe('a b')
    expect(canonicalUrl('https://WWW.x.com/a/?q=1#h')).toBe('https://www.x.com/a')
  })
})

describe('worstStatus', () => {
  it('picks the most severe', () => {
    expect(worstStatus([])).toBe('operational')
    expect(worstStatus(['operational', 'degraded', 'maintenance'])).toBe('degraded')
    expect(worstStatus(['partial_outage', 'major_outage'])).toBe('major_outage')
  })
})

describe('isHappeningNow', () => {
  const now = new Date('2026-10-23T12:00:00Z')
  it('service: unresolved only', () => {
    expect(
      isHappeningNow(
        { kind: 'service', status: 'investigating', publishedAt: '2026-01-01T00:00:00Z' },
        now,
      ),
    ).toBe(true)
    expect(
      isHappeningNow(
        { kind: 'service', status: 'resolved', publishedAt: '2026-10-23T00:00:00Z' },
        now,
      ),
    ).toBe(false)
    expect(
      isHappeningNow(
        {
          kind: 'service',
          resolvedAt: '2026-10-23T01:00:00Z',
          publishedAt: '2026-10-23T00:00:00Z',
        },
        now,
      ),
    ).toBe(false)
  })
  it('security: within 72h', () => {
    expect(isHappeningNow({ kind: 'security', publishedAt: '2026-10-21T12:00:00Z' }, now)).toBe(
      true,
    )
    expect(isHappeningNow({ kind: 'security', publishedAt: '2026-10-20T11:59:00Z' }, now)).toBe(
      false,
    )
  })
})

describe('cursor', () => {
  it('round-trips', () => {
    const c = encodeCursor({ publishedAt: '2026-10-23T00:00:00.000Z', id: 'src:ä/日本' })
    expect(c).not.toMatch(/[+/=]/)
    expect(decodeCursor(c)).toEqual({ publishedAt: '2026-10-23T00:00:00.000Z', id: 'src:ä/日本' })
    expect(decodeCursor('garbage')).toBeNull()
  })
})

describe('freshStatus', () => {
  const status = {
    providerId: 'x',
    status: 'operational' as const,
    checkedAt: '2026-10-23T12:00:00.000Z',
  }
  it('keeps recent statuses', () => {
    expect(freshStatus(status, new Date('2026-10-23T12:29:00Z')).status).toBe('operational')
  })
  it('turns stale statuses into unknown', () => {
    expect(freshStatus(status, new Date('2026-10-23T12:31:00Z'))).toMatchObject({
      status: 'unknown',
      checkedAt: status.checkedAt,
    })
  })
})

describe('decodeEntities', () => {
  it('decodes named and numeric references', () => {
    expect(decodeEntities('&lt;a&gt; &amp; &#39; &#x41; &#X42;')).toBe("<a> & ' A B")
  })
  it('leaves invalid or unknown references untouched', () => {
    expect(decodeEntities('&#xZZ; &#99999999; &constructor; &toString; &foo;')).toBe(
      '&#xZZ; &#99999999; &constructor; &toString; &foo;',
    )
  })
})
