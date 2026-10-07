import { defineConfig, devices } from '@playwright/test'

/**
 * End to end on the real API (Д28): the web app built as in production (no mocks)
 * against apps/api with a database of its own, seeded on every start
 * (apps/api/src/test/e2e-server.ts). Needs the local Postgres: `docker compose up -d db`.
 *
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: 'e2e-live',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5197',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    reducedMotion: 'reduce',
  },
  webServer: [
    {
      command: 'npx tsx --env-file=.env apps/api/src/test/e2e-server.ts',
      url: 'http://127.0.0.1:3021/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5197 --strictPort',
      url: 'http://localhost:5197',
      reuseExistingServer: false,
      // Set in full: a developer's .env.local must not point this run anywhere else.
      env: {
        VITE_USE_MOCKS: 'false',
        VITE_LIVE_API: 'true',
        VITE_LIVE_API_URL: 'http://127.0.0.1:3021',
        VITE_API_BASE_URL: '/api',
      },
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
