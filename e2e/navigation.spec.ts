import { expect, test, type Page } from '@playwright/test'

/** Back from a row lands on the page of the list it was opened from (customer, 2026-10-11). */
async function signIn(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('rvd.session', '1')
    localStorage.setItem('rvd.role', 'engineer')
  })
}

for (const [list, back] of [
  ['/equipment', 'К списку техники'],
  ['/products', 'К списку изделий'],
] as const) {
  test(`${list}: back returns to the same page of the list`, async ({ page }) => {
    await signIn(page)
    await page.goto(list)
    await page.getByRole('button', { name: '2', exact: true }).click()
    await expect(page).toHaveURL(/[?&]page=2\b/)
    await expect(page.getByText(/^Показано 11–/)).toBeVisible()

    await page.locator('tbody tr').first().click()
    await page.getByRole('link', { name: back }).click()

    await expect(page).toHaveURL(/[?&]page=2\b/)
    await expect(page.getByText(/^Показано 11–/)).toBeVisible()
  })
}
