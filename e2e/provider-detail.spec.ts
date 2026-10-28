import { expect, test } from '@playwright/test'
import { servicesPanel } from './support'

const section = (page: import('@playwright/test').Page, title: string) =>
  page.locator('section.section').filter({ has: page.getByRole('heading', { name: title }) })

test('NAV-01 navigates to detail without reloading and back with history', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'いま確認したいこと' })).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __e2eMarker: string }).__e2eMarker = 'kept'
  })

  await servicesPanel(page)
    .getByRole('link', { name: /Cloudflare/ })
    .click()
  await expect(page).toHaveURL('/d/cloudflare')
  await expect(page.getByRole('heading', { level: 1, name: 'Cloudflare' })).toBeVisible()
  expect(
    await page.evaluate(() => (window as unknown as { __e2eMarker?: string }).__e2eMarker),
  ).toBe('kept')

  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1, name: 'いま確認したいこと' })).toBeVisible()

  await page.goForward()
  await expect(page.getByRole('heading', { level: 1, name: 'Cloudflare' })).toBeVisible()
})

test('NAV-02 back link returns to the dashboard', async ({ page }) => {
  await page.goto('/d/github')
  await page.getByRole('link', { name: '← 一覧に戻る' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1, name: 'いま確認したいこと' })).toBeVisible()
})

test('NAV-03 deep links are served by the SPA fallback', async ({ page }) => {
  const res = await page.goto('/d/github/')
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'GitHub' })).toBeVisible()
  await expect(page.locator('.badge')).toHaveText('正常稼働')
  await expect(page.locator('.detail-message')).toHaveText('すべてのシステムが正常稼働しています')
})

test('NAV-04a malformed provider path shows not found on client navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'いま確認したいこと' })).toBeVisible()
  await page.evaluate(() => {
    history.pushState(null, '', '/d/%FF')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByText('ページが見つかりません。')).toBeVisible()
  await expect(page.getByRole('link', { name: '← 一覧に戻る' })).toBeVisible()
})

test('NAV-04b malformed escapes are normalized by the asset server on direct access', async ({
  page,
}) => {
  // Cloudflare のアセット配信が不正な % を %25 にリダイレクトするため、safeDecode までは届かない
  await page.goto('/d/%FF')
  await expect(page).toHaveURL('/d/%25FF')
  await expect(page.getByText('%FFの情報を取得できませんでした。')).toBeVisible()
})

test('NAV-05 unknown provider shows a load error', async ({ page }) => {
  await page.goto('/d/no-such-provider')
  await expect(page.getByText('no-such-providerの情報を取得できませんでした。')).toBeVisible()
})

test('DET-01 status provider shows status, incidents and history', async ({ page }) => {
  await page.goto('/d/cloudflare')
  await expect(page.locator('.detail-category')).toHaveText('クラウド・インフラ')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cloudflare')
  await expect(page.locator('.detail-status .badge')).toHaveText('大規模障害')
  await expect(page.locator('.detail-message')).toHaveText('1件の障害が発生中です')
  await expect(page.locator('.detail-status')).toContainText('に確認')

  const official = page.locator('.detail-links').getByRole('link', { name: 'cloudflarestatus.com' })
  await expect(official).toHaveAttribute('href', 'https://www.cloudflarestatus.com')
  await expect(official).toHaveAttribute('target', '_blank')

  await expect(section(page, '発生中の障害').locator('.incident-title')).toHaveText([
    'E2E Cloudflare API errors',
  ])
  await expect(section(page, '最近の復旧履歴').getByRole('link')).toHaveText([
    'E2E Cloudflare resolved latency',
  ])
  await expect(page.getByRole('heading', { name: 'セキュリティ情報' })).toHaveCount(0)
})

test('DET-02 notice-only provider lists official notices', async ({ page }) => {
  await page.goto('/d/sakura')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('さくらインターネット')
  await expect(page.locator('.detail-status .badge')).toHaveText('未判定')
  await expect(page.locator('.detail-message')).toHaveText(
    '公式の障害・メンテナンス告知を配信。現在の稼働状態は未判定です。',
  )
  await expect(page.locator('.detail-status')).not.toContainText('に確認')
  await expect(page.getByRole('heading', { name: '発生中の障害' })).toHaveCount(0)
  await expect(section(page, '公式の障害・メンテナンス告知').locator('.incident-title')).toHaveText(
    ['E2E さくら 新メンテナンス告知', 'E2E さくら 旧メンテナンス告知'],
  )
})

test('DET-03 security-only provider lists advisories', async ({ page }) => {
  await page.goto('/d/github-advisory')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('GitHub Advisory')
  await expect(page.locator('.detail-category')).toHaveText('セキュリティ')
  await expect(page.locator('.detail-status')).toHaveCount(0)
  await expect(page.locator('.detail-links').getByRole('link')).toHaveAttribute(
    'href',
    'https://github.com/advisories',
  )
  const advisories = section(page, 'セキュリティ情報').locator('.incident-title')
  await expect(advisories).toHaveCount(8)
  await expect(advisories.first()).toHaveText('E2E critical npm advisory 1')
  await expect(page.getByText('E2E withdrawn advisory')).toHaveCount(0)
})

test('DET-04 stale status is shown as unknown', async ({ page }) => {
  await page.goto('/d/vercel')
  await expect(page.locator('.detail-status .badge')).toHaveText('不明')
  await expect(page.locator('.detail-message')).toHaveText('稼働状況のデータが古くなっています')
  await expect(section(page, '発生中の障害')).toContainText('発生中の障害はありません。')
})
