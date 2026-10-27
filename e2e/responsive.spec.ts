import { expect, test } from '@playwright/test'
import { hasHorizontalOverflow, servicesPanel } from './support'

test('RWD-01 dashboard fits a phone viewport', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'いま確認したいこと' })).toBeVisible()
  await expect(page.getByRole('tablist')).toBeVisible()
  await expect(servicesPanel(page)).toBeAttached()
  expect(await hasHorizontalOverflow(page)).toBe(false)
})

test('RWD-02 provider detail fits a phone viewport', async ({ page }) => {
  await page.goto('/d/cloudflare')
  await expect(page.getByRole('heading', { level: 1, name: 'Cloudflare' })).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)
})
