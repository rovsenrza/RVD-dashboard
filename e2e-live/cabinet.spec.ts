import { expect, test, type Page } from '@playwright/test'

/**
 * A company's day in the cabinet on the real API (Д28): no mocks — sign-in, the
 * registry, a hose's own number, a note, a photo with its thumbnail, a replacement
 * request waiting for 1С, and the administrator's journal of all of it.
 * The API is seeded by apps/api/src/test/e2e-server.ts.
 */

/** A 1×1 PNG: enough for the server to check, store and reduce. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
)

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Электронная почта').fill(email)
  await page.getByLabel('Пароль').fill('e2e-password-1')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByText('Отгружено изделий')).toBeVisible()
}

test('a company works the cabinet end to end on the API', async ({ page }) => {
  await signIn(page, 'admin@e2e.test')
  // No sync in this run, and the rail says so rather than showing a time.
  await expect(page.getByText('Данных 1С ещё нет')).toBeVisible()

  await page.goto('/products')
  await expect(page.locator('tbody tr')).toHaveCount(4)

  // The number the company knows the hose by is kept by the cabinet.
  await page.goto('/products/h2')
  await expect(page.getByRole('heading', { name: /4102/ })).toBeVisible()
  await page.getByRole('button', { name: 'Изменить' }).click()
  await page.getByLabel('Внутренний номер').fill('K-77')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('K-77')).toBeVisible()

  // A note on the hose.
  await page.getByRole('tab', { name: /Комментарии/ }).click()
  const note = page.locator('form').filter({ has: page.locator('textarea') })
  await note.locator('textarea').fill('Проверено на e2e')
  await note.getByRole('button', { name: 'Добавить' }).click()
  await expect(page.getByText('Проверено на e2e')).toBeVisible()

  // A photo: stored, reduced, shown through a signed link.
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'фото.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  const thumb = page.getByRole('img', { name: 'фото.png' })
  await expect(thumb).toBeVisible()
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)

  // A replacement request waits for 1С (no order service in this run).
  await page.getByRole('button', { name: 'Создать заявку на замену' }).click()
  await page.getByRole('button', { name: 'Создать заявку', exact: true }).click()
  await page.goto('/requests')
  await expect(page.getByText('Отправляется в 1С').filter({ visible: true }).first()).toBeVisible()

  // The administrator's journal holds every step.
  await page.goto('/admin?tab=audit')
  for (const action of [
    'Создана заявка',
    'Добавлен файл',
    'Добавлен комментарий',
    'Изменён факт установки',
  ])
    await expect(page.getByText(action).filter({ visible: true }).first()).toBeVisible()
})

test('a mechanic is kept out of reports by the server, not only the menu', async ({ page }) => {
  await signIn(page, 'mechanic@e2e.test')
  await expect(page.getByRole('link', { name: 'Отчёты' })).toHaveCount(0)
  const login = await page.request.post('/api/auth/login', {
    data: { email: 'mechanic@e2e.test', password: 'e2e-password-1' },
  })
  const { accessToken } = await login.json()
  const report = await page.request.get('/api/reports/registry', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  expect(report.status()).toBe(403)
})

test('a company of several 1С clients picks its branch in the header', async ({ page }) => {
  await signIn(page, 'sites@e2e.test')
  await page.goto('/products')
  await expect(page.locator('tbody tr')).toHaveCount(3)

  // The header offers the company's branches — its clients in 1С — and narrows to one.
  await page.getByRole('button', { name: /Все филиалы/ }).click()
  await page.getByRole('menuitem', { name: 'Участок Б' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.getByText('5201').filter({ visible: true }).first()).toBeVisible()

  // The choice outlives a reload, and «all» brings the whole company back.
  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: /Участок Б/ }).click()
  await page.getByRole('menuitem', { name: 'Все филиалы компании' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(3)
})
