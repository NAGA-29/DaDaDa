import { expect, test } from '@playwright/test'
import { servicesPanel } from './support'

test('I18N-01 defaults to Japanese', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('いま確認したいこと')
  await expect(page.getByRole('combobox', { name: '表示言語' })).toHaveValue('ja')
})

test('I18N-02 switches the interface to English', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: '表示言語' }).selectOption('en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What needs your attention?')
  await expect(page.getByRole('tab', { name: /Security/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Known exploited/ })).toBeVisible()
  await expect(page.locator('.live')).toHaveText('LIVE')
  await expect(page.locator('.security-result')).toHaveText('Showing 4 of 7 matching items')
  await expect(servicesPanel(page).locator('.badge').first()).toHaveText('Major outage')
  await expect(page.locator('.highlight-label')).toHaveText('Active incidents · 2')
  await expect(page.locator('.highlight-item .pill').first()).toHaveText('Identified')
})

test('I18N-03 keeps the chosen language across reloads and pages', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: '表示言語' }).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(await page.evaluate(() => localStorage.getItem('dadada.locale'))).toBe('en')

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What needs your attention?')

  await page.goto('/d/cloudflare')
  await expect(page.locator('.detail-category')).toHaveText('Cloud & Infrastructure')
  await expect(page.locator('.detail-message')).toHaveText('1 active incident')
  await expect(page.getByRole('link', { name: '← Everything' })).toBeVisible()

  await page.getByRole('combobox', { name: 'Display language' }).selectOption('ja')
  await expect(page.locator('.detail-category')).toHaveText('クラウド・インフラ')
})
