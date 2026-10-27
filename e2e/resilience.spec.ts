import { expect, test } from '@playwright/test'
import type { SummaryResponse } from '../src/shared/api'
import { activePanel, servicesPanel } from './support'

const SUMMARY = '**/api/summary'
const REFRESH_MS = 60_000

test('RES-01/RES-02 initial failure offers a retry that recovers', async ({ page }) => {
  await page.route(SUMMARY, route => route.fulfill({ status: 500, json: { error: 'down' } }))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('DaDaDa APIに接続できませんでした。')
  await expect(page.locator('.live')).toHaveText('未接続')
  await expect(page.locator('.header-updated')).toHaveCount(0)

  await page.unroute(SUMMARY)
  await page.getByRole('button', { name: '再試行' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'いま確認したいこと' })).toBeVisible()
  await expect(page.locator('.live')).toHaveText('接続中')
})

test('RES-03 refresh failure keeps the last data with a stale banner', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await expect(page.locator('.highlight-label')).toHaveText('発生中の障害 2件')
  await expect(page.locator('.stale')).toHaveCount(0)

  await page.route(SUMMARY, route => route.fulfill({ status: 503, body: 'unavailable' }))
  await page.clock.fastForward(REFRESH_MS)

  await expect(page.locator('.stale')).toContainText('現在接続できないため')
  await expect(page.locator('.live')).toHaveText('未接続')
  await expect(page.locator('.highlight-label')).toHaveText('発生中の障害 2件')
  await expect(servicesPanel(page).locator('.service-name').first()).toHaveText('Cloudflare')
})

test('RES-04 periodic refresh shows newly collected incidents', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await expect(page.locator('.highlight-label')).toHaveText('発生中の障害 2件')

  await page.route(SUMMARY, async route => {
    const res = await route.fetch()
    const body = (await res.json()) as SummaryResponse
    const base = body.happeningNow.find(i => i.id === 'cloudflare:e2e-active')!
    body.happeningNow.unshift({
      ...base,
      id: 'github:e2e-refresh',
      providerId: 'github',
      title: 'E2E GitHub Actions delayed',
      startedAt: new Date().toISOString(),
    })
    await route.fulfill({ response: res, json: body })
  })
  await page.clock.fastForward(REFRESH_MS)

  await expect(page.locator('.highlight-label')).toHaveText('発生中の障害 3件')
  await expect(page.locator('.highlight-item').first().getByRole('heading')).toHaveText(
    'GitHub · E2E GitHub Actions delayed',
  )
})

test('RES-05 empty data renders empty states', async ({ page }) => {
  const empty: SummaryResponse = {
    generatedAt: new Date().toISOString(),
    happeningNow: [],
    services: [],
    serviceNotices: [],
    security: [],
    kev: [],
    providers: [],
  }
  await page.route(SUMMARY, route => route.fulfill({ json: empty }))
  await page.goto('/')

  const highlight = page.getByRole('region', { name: '発生中の障害' })
  await expect(highlight).toHaveClass(/is-clear/)
  await expect(highlight.getByRole('heading')).toHaveText('発生中の障害はありません。')
  await expect(servicesPanel(page)).toContainText('稼働状況はまだ取得されていません。')
  await expect(activePanel(page).locator('.feed-empty')).toHaveText(
    '条件に一致するアラートはありません。',
  )
  for (const tab of await page.getByRole('tab').locator('.tab-count').all()) {
    await expect(tab).toHaveText('0')
  }

  await page.getByRole('tab', { name: /悪用確認済み/ }).click()
  await expect(activePanel(page).locator('.feed-empty')).toHaveText(
    '過去30日間に追加された脆弱性はありません。',
  )
})
