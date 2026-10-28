import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const PERSIST_DIR = '.wrangler/e2e-state'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /responsive\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /responsive\.spec\.ts/,
    },
  ],
  // シード済みのローカル D1 で本番ビルド (Worker + 静的アセット) を起動する
  webServer: {
    command: `node e2e/scripts/prepare-db.mjs && pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/api/health`,
    env: {
      DADADA_PERSIST_DIR: PERSIST_DIR,
      CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
      ADMIN_TOKEN: 'e2e-admin-token',
    },
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
