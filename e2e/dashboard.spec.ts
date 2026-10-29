import { expect, test } from '@playwright/test'
import { activePanel, feedTitles, filterSelect, servicesPanel } from './support'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'いま確認したいこと' })).toBeVisible()
})

test('UI-01 renders the dashboard shell', async ({ page }) => {
  await expect(page.getByRole('img', { name: 'DaDaDa' })).toBeVisible()
  await expect(page.getByText('開発に影響する障害やセキュリティ情報を、ひと目で。')).toBeVisible()
  await expect(page.locator('.live')).toHaveText('接続中')
  await expect(page.locator('.live')).not.toHaveClass(/offline/)
  await expect(page.locator('.header-updated')).toContainText('画面更新')
  await expect(page.locator('footer')).toContainText(
    'DaDaDaは公開ステータスとセキュリティ情報を収集しています',
  )
  await expect(page).toHaveTitle('DaDaDa')
})

test('UI-02 highlights active service incidents', async ({ page }) => {
  const highlight = page.getByRole('region', { name: '発生中の障害' })
  await expect(highlight.locator('.highlight-label')).toHaveText('発生中の障害 2件')
  const items = highlight.locator('.highlight-item')
  await expect(items).toHaveCount(2)
  // startedAt の新しい順
  await expect(items.nth(0).getByRole('heading')).toHaveText('E2E Orphan service incident')
  await expect(items.nth(0).locator('.pill')).toHaveText('原因特定済み')
  await expect(items.nth(1).getByRole('heading')).toHaveText(
    'Cloudflare · E2E Cloudflare API errors',
  )
  await expect(items.nth(1).locator('.pill')).toHaveText('調査中')
  await expect(highlight).not.toContainText('E2E Cloudflare resolved latency')
  await expect(highlight).not.toContainText('メンテナンス告知')
})

test('UI-03 highlight links to provider detail or the official source', async ({ page }) => {
  const items = page.getByRole('region', { name: '発生中の障害' }).locator('.highlight-item')
  const official = items.nth(0).getByRole('link', { name: '公式情報' })
  await expect(official).toHaveAttribute('href', 'https://example.com/e2e-orphan')
  await expect(official).toHaveAttribute('target', '_blank')

  await items.nth(1).getByRole('link', { name: '障害の詳細を見る' }).click()
  await expect(page).toHaveURL('/d/cloudflare')
  await expect(page.getByRole('heading', { level: 1, name: 'Cloudflare' })).toBeVisible()
})

test('UI-04 security tab is selected by default with counts', async ({ page }) => {
  const tabs = page.getByRole('tablist', { name: '情報の種類' }).getByRole('tab')
  await expect(tabs).toHaveCount(3)
  await expect(page.getByRole('tab', { name: /セキュリティ/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('tab', { name: /セキュリティ/ }).locator('.tab-count')).toHaveText(
    '7',
  )
  await expect(page.getByRole('tab', { name: /公式告知/ }).locator('.tab-count')).toHaveText('2')
  await expect(page.getByRole('tab', { name: /悪用確認済み/ }).locator('.tab-count')).toHaveText(
    '1',
  )
  await expect(activePanel(page)).toContainText('取得済みのセキュリティ情報')
  await expect(filterSelect(page, '深刻度')).toHaveValue('critical')
  await expect(filterSelect(page, '言語')).toHaveValue('')
})

test('UI-05 severity filter switches the security feed', async ({ page }) => {
  const result = activePanel(page).locator('.security-result')
  await expect(result).toHaveText('該当7件中 4件を表示')

  await filterSelect(page, '深刻度').selectOption('high')
  await expect(result).toHaveText('該当1件中 1件を表示')
  await expect(feedTitles(page)).toHaveText(['E2E high pip advisory'])
  await expect(activePanel(page).locator('.pill').first()).toHaveText('高')

  await filterSelect(page, '深刻度').selectOption('all')
  await expect(result).toHaveText('該当8件中 4件を表示')
  await expect(page.getByRole('tab', { name: /セキュリティ/ }).locator('.tab-count')).toHaveText(
    '8',
  )
})

test('UI-06 language filter narrows advisories', async ({ page }) => {
  const result = activePanel(page).locator('.security-result')
  await filterSelect(page, '言語').selectOption({ label: 'PHP' })
  await expect(result).toHaveText('該当1件中 1件を表示')
  await expect(feedTitles(page)).toHaveText(['E2E critical composer advisory'])

  await filterSelect(page, '言語').selectOption({ label: 'Python' })
  await expect(result).toHaveText('該当0件中 0件を表示')
  await expect(activePanel(page).locator('.feed-empty')).toHaveText(
    '条件に一致するアラートはありません。',
  )

  await filterSelect(page, '深刻度').selectOption('high')
  await expect(feedTitles(page)).toHaveText(['E2E high pip advisory'])
})

test('UI-07 show more reveals the remaining items', async ({ page }) => {
  await expect(feedTitles(page)).toHaveText([
    'E2E critical npm advisory 1',
    'E2E critical npm advisory 2',
    'E2E critical npm advisory 3',
    'E2E critical npm advisory 4',
  ])
  const more = activePanel(page).getByRole('button', { name: 'さらに3件を表示' })
  await more.click()
  await expect(feedTitles(page)).toHaveCount(7)
  await expect(activePanel(page).locator('.security-result')).toHaveText('該当7件中 7件を表示')
  await expect(activePanel(page).getByRole('button', { name: /さらに/ })).toHaveCount(0)
})

test('UI-08 official notices tab shows latest notices and unscored advisories', async ({
  page,
}) => {
  await page.getByRole('tab', { name: /公式告知/ }).click()
  await expect(activePanel(page)).toHaveAttribute('id', 'panel-notices')
  await expect(activePanel(page)).toContainText('各サービスの最新告知')
  await expect(feedTitles(page)).toHaveText([
    'E2E Node.js security release',
    'E2E さくら 新メンテナンス告知',
  ])
  await expect(activePanel(page).locator('.pill', { hasText: '告知' })).toHaveCount(1)
  await expect(filterSelect(page, '言語')).toBeVisible()
  await expect(filterSelect(page, '深刻度')).toHaveCount(0)
})

test('UI-09 known exploited tab lists recent KEV only', async ({ page }) => {
  await page.getByRole('tab', { name: /悪用確認済み/ }).click()
  await expect(activePanel(page)).toContainText('CISA KEV・全言語・過去30日間')
  await expect(feedTitles(page)).toHaveText(['E2E KEV recent exploited'])
  await expect(activePanel(page).locator('.security-filters')).toHaveCount(0)
  await expect(activePanel(page).locator('.incident').first()).toHaveClass(/tone-critical/)
})

test('UI-10 tabs support keyboard navigation', async ({ page }) => {
  const tab = (name: RegExp) => page.getByRole('tab', { name })
  await tab(/セキュリティ/).focus()

  await page.keyboard.press('ArrowRight')
  await expect(tab(/公式告知/)).toHaveAttribute('aria-selected', 'true')
  await expect(tab(/公式告知/)).toBeFocused()

  await page.keyboard.press('End')
  await expect(tab(/悪用確認済み/)).toHaveAttribute('aria-selected', 'true')
  await expect(tab(/悪用確認済み/)).toBeFocused()

  await page.keyboard.press('ArrowRight')
  await expect(tab(/セキュリティ/)).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('ArrowLeft')
  await expect(tab(/悪用確認済み/)).toBeFocused()

  await page.keyboard.press('Home')
  await expect(tab(/セキュリティ/)).toBeFocused()
  await expect(tab(/セキュリティ/)).toHaveAttribute('tabindex', '0')
  await expect(tab(/公式告知/)).toHaveAttribute('tabindex', '-1')
})

test('UI-11 feed rows show CVEs and external official links', async ({ page }) => {
  const row = activePanel(page).locator('.incident', { hasText: 'E2E critical npm advisory 4' })
  await expect(row.locator('code.cve')).toHaveText([
    'CVE-2026-10004',
    'CVE-2026-10014',
    'CVE-2026-10024',
  ])
  await expect(row).toContainText('+2')
  await expect(row.getByRole('link', { name: 'GitHub Advisory' })).toHaveAttribute(
    'href',
    '/d/github-advisory',
  )
  for (const link of await row.locator('a[target="_blank"]').all()) {
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(link).toHaveAttribute('href', 'https://github.com/advisories/GHSA-e2e0-crit-0004')
  }
  await expect(row.locator('a[target="_blank"]')).toHaveCount(2)
})

test('UI-12 service tabs filter providers and preserve severity ordering', async ({ page }) => {
  const panel = servicesPanel(page)
  await expect(panel.getByRole('tab')).toHaveText(['クラウド', '開発ツール', 'AI'])
  await expect(panel.getByRole('tab', { name: 'クラウド', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(panel.locator('.service-name')).toHaveText([
    'Cloudflare',
    'Netlify',
    'Vercel',
    'さくらインターネット',
  ])
  await expect(panel.locator('.badge')).toHaveText(['大規模障害', '不明', '不明', '未判定'])
  const notes = panel.locator('.service-note')
  await expect(notes.nth(0)).toContainText('に確認')
  await expect(notes.nth(1)).toHaveText('最新状態を確認できません')
  await expect(notes.nth(2)).toHaveText('最新状態を確認できません')
  await expect(notes.nth(3)).toHaveText('公開告知のみ')
  await expect(panel.locator('.badge').nth(0)).toHaveClass(/tone-critical/)
  await panel.getByRole('tab', { name: '開発ツール' }).click()
  await expect(panel.locator('.service-name')).toHaveText(['GitHub'])
  await expect(panel.locator('.badge')).toHaveText(['正常稼働'])
  await expect(panel.locator('.badge')).toHaveClass(/tone-ok/)
  await expect(panel.locator('.service-note')).toContainText('に確認')

  await page.keyboard.press('ArrowRight')
  await expect(panel.getByRole('tab', { name: 'AI', exact: true })).toBeFocused()
  await expect(panel.getByRole('tabpanel')).toHaveText('稼働状況はまだ取得されていません。')
  await page.keyboard.press('Home')
  await expect(panel.getByRole('tab', { name: 'クラウド', exact: true })).toBeFocused()
  await expect(panel.locator('.service-name')).toHaveCount(4)
})

test('UI-13 withdrawn, merged and expired records never reach the page', async ({ page }) => {
  await filterSelect(page, '深刻度').selectOption('all')
  await activePanel(page)
    .getByRole('button', { name: /さらに/ })
    .click()
  await expect(feedTitles(page)).toHaveCount(8)
  for (const tab of [/セキュリティ/, /公式告知/, /悪用確認済み/]) {
    await page.getByRole('tab', { name: tab }).click()
    await expect(activePanel(page)).not.toContainText('E2E withdrawn advisory')
    await expect(activePanel(page)).not.toContainText('E2E JPCERT duplicate')
    await expect(activePanel(page)).not.toContainText('E2E KEV expired')
    await expect(activePanel(page)).not.toContainText('旧メンテナンス告知')
  }
})
