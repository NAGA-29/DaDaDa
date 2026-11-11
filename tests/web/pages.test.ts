import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type {
  IncidentView,
  Provider,
  ProviderDetailResponse,
  SummaryResponse,
} from '../../src/shared/api'
import { Home } from '../../src/web/features/Home'
import {
  ProviderDetail,
  ProviderDetailView,
} from '../../src/web/features/provider-detail/ProviderDetail'
import { I18nProvider } from '../../src/web/lib/i18n'
import { type Locale, translate } from '../../src/web/lib/messages'
import type { Loadable } from '../../src/web/lib/api'

const NOW = '2026-11-10T12:00:00.000Z'

const alpha: Provider = {
  id: 'alpha',
  name: 'Alpha Cloud',
  category: 'cloud',
  homepageUrl: 'https://alpha.example.com',
  statusUrl: 'https://status.alpha.example.com',
  supportsStatus: true,
  supportsSecurity: false,
}
const gamma: Provider = {
  id: 'gamma',
  name: 'Gamma Lang',
  category: 'runtime',
  homepageUrl: 'https://gamma.example.com',
  supportsStatus: false,
  supportsSecurity: true,
}

function incident(over: Partial<IncidentView> & { id: string }): IncidentView {
  return {
    kind: 'service',
    source: 'test',
    title: over.id,
    url: `https://example.com/${over.id}`,
    publishedAt: NOW,
    collectedAt: NOW,
    ...over,
  }
}

const summary = (over: Partial<SummaryResponse> = {}): SummaryResponse => ({
  generatedAt: NOW,
  happeningNow: [],
  services: [],
  security: [],
  kev: [],
  providers: [alpha, gamma],
  ...over,
})

const loadable = <T>(over: Partial<Loadable<T>>): Loadable<T> => ({
  data: null,
  error: null,
  loading: false,
  reload: () => {},
  ...over,
})

function wrap(locale: Locale, child: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(createElement(I18nProvider, { initialLocale: locale }, child))
}

const renderHome = (data: Loadable<SummaryResponse>, locale: Locale = 'ja') =>
  wrap(locale, createElement(Home, { summary: data }))

const renderDetail = (data: ProviderDetailResponse, locale: Locale = 'ja') =>
  wrap(locale, createElement(ProviderDetailView, { data }))

const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
  translate('ja', key, params)

describe('Home', () => {
  it('shows a loading state before the first response', () => {
    const html = renderHome(loadable({ loading: true }))
    expect(html).toContain(t('scanning'))
    expect(html).not.toContain(t('retry'))
  })

  it('shows an error with a retry button when the first request fails', () => {
    const html = renderHome(loadable({ error: new Error('down') }))
    expect(html).toContain(t('apiError'))
    expect(html).toContain(t('retry'))
  })

  it('shows the all-clear state when nothing is active', () => {
    const html = renderHome(loadable({ data: summary() }))
    expect(html).toContain(t('noActive'))
    expect(html).toContain('is-clear')
    expect(html).not.toContain('highlight-item')
  })

  it('highlights active service incidents with provider name, status and links', () => {
    const html = renderHome(
      loadable({
        data: summary({
          happeningNow: [
            incident({
              id: 'a1',
              providerId: 'alpha',
              title: 'API errors',
              status: 'investigating',
            }),
            incident({ id: 'orphan', title: 'Orphan incident', status: 'identified' }),
          ],
        }),
      }),
    )
    expect(html).toContain(t('activeIncidentCount', { count: 2 }))
    expect(html).toContain('Alpha Cloud · API errors')
    expect(html).toContain('href="/d/alpha"')
    // provider が不明な障害は公式情報へ直接リンクする
    expect(html).toContain('href="https://example.com/orphan"')
  })

  it('does not count security advisories among the active service incidents', () => {
    const html = renderHome(
      loadable({
        data: summary({
          happeningNow: [
            incident({ id: 'svc', providerId: 'alpha', status: 'investigating' }),
            incident({ id: 'sec', kind: 'security', providerId: 'gamma', severity: 'critical' }),
          ],
        }),
      }),
    )
    expect(html).toContain(t('activeIncidentCount', { count: 1 }))
  })

  it('shows tab counts for security (critical by default), notices and exploited', () => {
    const html = renderHome(
      loadable({
        data: summary({
          security: [
            incident({ id: 'c1', kind: 'security', severity: 'critical' }),
            incident({ id: 'c2', kind: 'security', severity: 'critical' }),
            incident({ id: 'h1', kind: 'security', severity: 'high' }),
            incident({ id: 'u1', kind: 'security' }),
          ],
          kev: [incident({ id: 'k1', kind: 'security', source: 'cisa-kev' })],
          serviceNotices: [incident({ id: 'n1', providerId: 'alpha', status: 'notice' })],
        }),
      }),
    )
    const counts = [...html.matchAll(/class="tab-count">(\d+)</g)].map(m => Number(m[1]))
    // security: critical の 2 件 / notices: 最新告知 1 + 未評価の advisory 1 / kev: 1
    expect(counts).toEqual([2, 2, 1])
    expect(html).toContain('c1')
    expect(html).not.toContain('>h1<')
  })

  it('keeps the last data and shows a stale banner when a refresh fails', () => {
    const html = renderHome(loadable({ data: summary(), error: new Error('503') }))
    expect(html).toContain('class="stale"')
    expect(html).toContain(t('noActive'))
  })

  it('renders the provider status list', () => {
    const html = renderHome(
      loadable({
        data: summary({
          services: [
            {
              ...alpha,
              currentStatus: { providerId: 'alpha', status: 'degraded', checkedAt: NOW },
            },
          ],
        }),
      }),
    )
    expect(html).toContain('Alpha Cloud')
    expect(html).toContain('href="/d/alpha"')
  })

  it('renders in English', () => {
    const html = renderHome(
      loadable({
        data: summary({
          happeningNow: [incident({ id: 'a1', providerId: 'alpha', status: 'identified' })],
        }),
      }),
      'en',
    )
    expect(html).toContain('Active incidents · 1')
    expect(html).toContain('Identified')
  })
})

describe('ProviderDetail', () => {
  const base: ProviderDetailResponse = {
    provider: alpha,
    currentStatus: { providerId: 'alpha', status: 'degraded', message: 'Slow API', checkedAt: NOW },
    activeIncidents: [],
    recentIncidents: [],
    securityAdvisories: [],
    officialNotices: [],
  }

  it('shows a loading state while the provider is being fetched', () => {
    const html = wrap('ja', createElement(ProviderDetail, { id: 'alpha' }))
    expect(html).toContain(t('loading'))
    expect(html).toContain('href="/"')
  })

  it('renders provider header, category, status and official status link', () => {
    const html = renderDetail(base)
    expect(html).toContain('Alpha Cloud')
    expect(html).toContain(t('category.cloud'))
    expect(html).toContain('status.alpha.example.com')
    expect(html).toContain(t('officialStatus'))
  })

  it('shows the empty message when there are no active incidents', () => {
    const html = renderDetail(base)
    expect(html).toContain(t('currentIncidents'))
    expect(html).toContain(t('noActive'))
  })

  it('lists active incidents without repeating the provider name on each row', () => {
    const html = renderDetail({
      ...base,
      activeIncidents: [
        incident({ id: 'a1', providerId: 'alpha', title: 'API errors', status: 'investigating' }),
      ],
    })
    expect(html).toContain('API errors')
    expect(html).not.toContain(t('noActive'))
    expect(html).not.toContain('class="incident-provider"')
  })

  it('shows recovery history only when there is some', () => {
    expect(renderDetail(base)).not.toContain(t('recentHistory'))
    const html = renderDetail({
      ...base,
      recentIncidents: [incident({ id: 'r1', title: 'Past outage', status: 'resolved' })],
    })
    expect(html).toContain(t('recentHistory'))
    expect(html).toContain('Past outage')
  })

  it('shows official notices when present', () => {
    const html = renderDetail({
      ...base,
      officialNotices: [incident({ id: 'n1', title: 'Planned maintenance', status: 'notice' })],
    })
    expect(html).toContain(t('serviceNotices'))
    expect(html).toContain('Planned maintenance')
  })

  it('for notice-only providers (unverified) hides the active incident section', () => {
    const html = renderDetail({
      ...base,
      currentStatus: { providerId: 'alpha', status: 'unverified', checkedAt: NOW },
    })
    expect(html).toContain(t('serviceNotices'))
    expect(html).toContain(t('noNotices'))
    expect(html).not.toContain(t('currentIncidents'))
  })

  it('security providers show advisories and no status section', () => {
    const html = renderDetail({
      ...base,
      provider: gamma,
      currentStatus: null,
      securityAdvisories: [
        incident({ id: 's1', kind: 'security', title: 'Critical RCE', severity: 'critical' }),
      ],
    })
    expect(html).toContain('Gamma Lang')
    expect(html).toContain(t('security'))
    expect(html).toContain('Critical RCE')
    expect(html).not.toContain(t('currentIncidents'))
    expect(html).not.toContain(t('recentHistory'))
  })

  it('shows an empty advisories message for security providers with no data', () => {
    const html = renderDetail({ ...base, provider: gamma, currentStatus: null })
    expect(html).toContain(t('noAdvisories'))
  })
})
