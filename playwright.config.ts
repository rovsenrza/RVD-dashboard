import { defineConfig, devices } from '@playwright/test'

/**
 * Visual regression (Д15): the key screens in both themes, on desktop and a phone,
 * against committed baselines in e2e/__screenshots__.
 *
 *   npm run test:visual          — compare against the baselines
 *   npm run test:visual:update   — accept an intended change (review the diff first)
 *
 * Baselines are macOS renders with Playwright's own Chromium; font rasterisation
 * differs on Linux, so this runs locally before UI changes ship, not in CI.
 */
export default defineConfig({
  testDir: 'e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5198',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    // Charts honour reduced motion, so no screenshot lands mid-animation.
    reducedMotion: 'reduce',
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 },
  },
  webServer: {
    command: 'npx vite --port 5198 --strictPort',
    url: 'http://localhost:5198',
    reuseExistingServer: true,
    env: { VITE_USE_MOCKS: 'true' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
