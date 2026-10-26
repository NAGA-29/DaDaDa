import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../src/web/lib/i18n'
import { savedLocale, translate, type Locale } from '../../src/web/lib/messages'
import { formatDate, humanize, statusMessage, timeAgo } from '../../src/web/lib/format'
import { Home } from '../../src/web/features/Home'
import { Header } from '../../src/web/components/Header'
import type { SummaryResponse } from '../../src/shared/api'

const now = new Date('2026-10-24T12:00:00Z')
const provider = {
  id: 'supabase',
  name: 'Supabase',
  category: 'cloud' as const,
  homepageUrl: 'https://supabase.com',
  supportsStatus: true,
  supportsSecurity: false,
}
const incident = {
  id: 'example',
  providerId: 'supabase',
  kind: 'service' as const,
  source: 'example',
  title: 'Original upstream title',
  url: 'https://status.supabase.com/',
  status: 'monitoring',
  severity: 'minor',
  publishedAt: now.toISOString(),
  collectedAt: now.toISOString(),
}
const data: SummaryResponse = {
  generatedAt: now.toISOString(),
  happeningNow: [incident],
  services: [
    {
      ...provider,
      currentStatus: { providerId: 'supabase', status: 'degraded', checkedAt: now.toISOString() },
    },
  ],
  providers: [provider],
  security: [],
  kev: [],
}

function render(locale: Locale, summary = data) {
  return renderToStaticMarkup(
    createElement(
      I18nProvider,
      { initialLocale: locale },
      createElement(Header, { live: true }),
      createElement(Home, {
        summary: { data: summary, error: null, loading: false, reload: () => {} },
      }),
    ),
  )
}

describe('Japanese and English display', () => {
  it('defaults to Japanese and safely restores only supported language preferences', () => {
    expect(savedLocale()).toBe('ja')
    expect(savedLocale({ getItem: () => null })).toBe('ja')
    expect(savedLocale({ getItem: () => 'en' })).toBe('en')
    expect(savedLocale({ getItem: () => 'fr' })).toBe('ja')
    expect(
      savedLocale({
        getItem: () => {
          throw new Error('Storage denied')
        },
      }),
    ).toBe('ja')
  })

  it('renders both languages across the dashboard while keeping upstream text unchanged', () => {
    const ja = render('ja')
    expect(ja).toContain('いま確認したいこと')
    expect(ja).toContain('セキュリティ')
    expect(ja).toContain('性能低下')
    expect(ja).toContain('経過観察中')
    expect(ja).toContain('Original upstream title')
    const en = render('en')
    expect(en).toContain('What needs your attention?')
    expect(en).toContain('Security')
    expect(en).toContain('Degraded')
    expect(en).toContain('Monitoring')
    expect(en).toContain('Original upstream title')
    expect(en).not.toContain('経過観察中')
  })

  it('uses the selected language for relative dates and placeholders', () => {
    const before = new Date(now.getTime() - 120000).toISOString()
    expect(timeAgo(before, now.getTime(), 'ja')).toBe('2 分前')
    expect(timeAgo(before, now.getTime(), 'en')).toBe('2 min. ago')
    expect(formatDate(now.toISOString(), 'ja')).toContain('2026年')
    expect(formatDate(now.toISOString(), 'en')).toContain('2026')
    expect(translate('ja', 'matchingAlerts', { count: 0 })).toBe('0件のアラートが該当')
  })

  it('localizes known states and application messages, preserving unfamiliar upstream prose', () => {
    expect(humanize('critical', 'ja')).toBe('緊急')
    expect(humanize('critical', 'en')).toBe('Critical')
    expect(humanize('custom_state', 'ja')).toBe('Custom state')
    expect(statusMessage('Status data is stale', 'ja')).toBe('稼働状況のデータが古くなっています')
    expect(statusMessage('2 active incidents', 'ja')).toBe('2件の障害が発生中です')
    expect(statusMessage('Official custom announcement', 'ja')).toBe('Official custom announcement')
    expect(statusMessage('公式RSSの公開告知を配信。現在の稼働状態は未判定です。', 'en')).toContain(
      'unverified',
    )
  })
})

describe('Overview information hierarchy', () => {
  it('keeps unscored notices out of the security count and active incident callout', () => {
    const notice = {
      ...incident,
      id: 'notice',
      status: 'notice',
      severity: undefined,
      title: 'Routine maintenance notice',
    }
    const security = {
      ...incident,
      id: 'security',
      kind: 'security' as const,
      severity: 'critical',
      title: 'Critical advisory',
    }
    const html = render('en', {
      ...data,
      security: [security, { ...notice, kind: 'security' }],
      serviceNotices: [notice],
    })
    expect(html).toContain('Active incidents · 1')
    expect(html).toContain('Showing 1 of 1 matching items')
    expect(html).toContain('Critical advisory')
    expect(html).not.toContain('Routine maintenance notice')
    expect(html).toContain('role="tab"')
    expect(html).toContain('aria-selected="true"')
  })

  it('does not imply that unknown services are healthy when there are no active incidents', () => {
    const html = render('en', {
      ...data,
      happeningNow: [],
      services: [{ ...provider, currentStatus: null }],
    })
    expect(html).toContain('No active incidents.')
    expect(html).toContain('Within the official information collected.')
    expect(html).toContain('Latest status unavailable')
    expect(html).not.toContain('Operational')
  })
})
