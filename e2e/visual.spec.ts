import { expect, test, type Page } from '@playwright/test'

/** Mock data counts days from «now»; freezing the clock freezes every date on screen. */
const NOW = new Date('2026-09-23T10:00:00+03:00')

type Role = 'mechanic' | 'engineer' | 'manager' | 'admin'

async function open(page: Page, path: string, theme: 'light' | 'dark', role: Role = 'engineer') {
  await page.clock.setFixedTime(NOW)
  await page.addInitScript(
    ([t, r]) => {
      localStorage.setItem('rvd.session', '1')
      localStorage.setItem('rvd.theme', t)
      localStorage.setItem('rvd.role', r)
    },
    [theme, role],
  )
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  // Data has arrived once the shaped skeletons are gone.
  await expect(page.locator('.animate-pulse')).toHaveCount(0)
}

const DESKTOP: { name: string; path: string; role?: Role; themes: ('light' | 'dark')[] }[] = [
  { name: 'dashboard', path: '/', themes: ['light', 'dark'] },
  { name: 'products', path: '/products', themes: ['light'] },
  { name: 'product', path: '/products/p-4', themes: ['light', 'dark'] },
  { name: 'equipment', path: '/equipment', themes: ['light'] },
  { name: 'equipment-card', path: '/equipment/eq-1', themes: ['light'] },
  { name: 'replacements', path: '/replacements', themes: ['light'] },
  { name: 'requests', path: '/requests', themes: ['light'] },
  { name: 'notifications', path: '/notifications', themes: ['light', 'dark'] },
  { name: 'compare', path: '/compare', role: 'manager', themes: ['light', 'dark'] },
  { name: 'reports', path: '/reports?r=equipment', role: 'manager', themes: ['light', 'dark'] },
  // Paper is always light, whatever the theme; a fixed period keeps it stable.
  {
    name: 'report-print',
    path: '/reports/print?r=equipment&from=2025-09-23&to=2026-09-23',
    role: 'manager',
    themes: ['dark'],
  },
  { name: 'admin-users', path: '/admin', role: 'admin', themes: ['light'] },
  { name: 'admin-settings', path: '/admin?tab=settings', role: 'admin', themes: ['light'] },
  { name: 'admin-audit', path: '/admin?tab=audit', role: 'admin', themes: ['light'] },
]

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  for (const screen of DESKTOP)
    for (const theme of screen.themes)
      test(`${screen.name} · ${theme}`, async ({ page }) => {
        await open(page, screen.path, theme, screen.role)
        await expect(page).toHaveScreenshot(`${screen.name}-${theme}.png`)
      })

  test('login · light', async ({ page }) => {
    await page.clock.setFixedTime(NOW)
    await page.goto('/login')
    // The mock worker may reload the page once while it takes control; wait that out too.
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('login-light.png')
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  for (const [name, path] of [
    ['dashboard', '/'],
    ['products', '/products'],
    ['product', '/products/p-4'],
  ] as const)
    test(`${name} · phone`, async ({ page }) => {
      await open(page, path, 'light')
      await expect(page).toHaveScreenshot(`${name}-phone.png`)
    })

  test('replacement sheet · phone', async ({ page }) => {
    await open(page, '/products/p-4', 'light')
    await page.getByRole('button', { name: 'Замена' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveScreenshot('replacement-sheet-phone.png')
  })
})
