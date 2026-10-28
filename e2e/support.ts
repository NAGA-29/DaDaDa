import type { Locator, Page } from '@playwright/test'

/** フィード上部の絞り込み (言語 / 深刻度)。label 内の select は名前に選択肢が混ざるため構造で引く */
export function filterSelect(
  page: Page,
  label: '言語' | '深刻度' | 'Language' | 'Severity',
): Locator {
  return page
    .locator('.security-filters label')
    .filter({ hasText: new RegExp(`^${label}`) })
    .locator('select')
}

export function activePanel(page: Page): Locator {
  return page.locator('[role="tabpanel"]:not([hidden])')
}

export function feedTitles(page: Page): Locator {
  return activePanel(page).locator('.incident-title')
}

export function servicesPanel(page: Page): Locator {
  return page.getByRole('complementary', { name: /サービスの稼働状況|Service status/ })
}

/** document が横にはみ出していないか */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
}
