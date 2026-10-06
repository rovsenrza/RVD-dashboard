// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, type CabinetNotification, type Product } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import { addUser } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { machine, product } from '../test/rows.ts'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'
const TODAY = '2026-10-03'

describe.skipIf(!hasDb)('notifications on the server', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let admin: string
  let engineer: string

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) =>
    app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } })
  const signIn = async (email: string, password: string) =>
    (await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })).json()
      .accessToken as string
  const list = async (token: string) =>
    (await call('GET', '/notifications', token)).json() as CabinetNotification[]

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    const romashka = { company: 'ООО Ромашка', clientKey: 'k1' }
    await addUser(db, {
      ...romashka,
      name: 'Админ',
      email: 'admin@romashka.ru',
      password: 'админ-пароль-1',
      role: 'admin',
    })
    await addUser(db, {
      ...romashka,
      name: 'Инженер',
      email: 'engineer@romashka.ru',
      password: 'инженер-пароль-1',
      role: 'engineer',
    })
    // Accounts older than the window, so it is the window that bounds the list.
    await db.query("update users set created_at = '2026-01-01'")
    const hose = (id: string, over: Partial<Product>) =>
      product({ lifecycle: 'shipped', warrantyDays: 180, serviceLifeDays: 365, ...over, id })
    await storeCache(
      db,
      {
        products: [
          // Planned 17.10.2026: 30 days ahead fired 17.09, 14 days ahead today.
          {
            product: hose('h1', { serialNumber: '11', shippedAt: '2025-10-17', equipmentId: 'e1' }),
            clientId: 'k1',
          },
          // Planned 20.09.2026: 14 and 7 days ahead, then overdue on the day.
          { product: hose('h2', { serialNumber: '12', shippedAt: '2025-09-20' }), clientId: 'k1' },
          {
            product: hose('h3', {
              serialNumber: '13',
              shippedAt: '2025-10-17',
              lifecycle: 'written_off',
            }),
            clientId: 'k1',
          },
          { product: hose('h4', { serialNumber: '14', shippedAt: '2025-10-17' }), clientId: 'k2' },
        ],
        equipment: [{ equipment: machine('e1', { garageNumber: 'НТ08' }), clientId: 'k1' }],
      },
      1,
    )
    await db.query(
      `insert into requests (id, client_id, branch_id, kind, positions, author, number, status,
         delivery, closed_at)
       values ('r1', 'k1', 'b1', 'replace', '[{"productId": "h2"}]', '{}', 'СВЦБ-000101', 'done',
         'delivered', '2026-10-01T10:00:00Z'),
              ('r2', 'k2', 'b1', 'replace', '[]', '{}', 'СВЦБ-000102', 'rejected',
         'delivered', '2026-10-01T10:00:00Z')`,
    )
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: TODAY, rules: DEFAULT_RULES }),
      auth: { secret: SECRET },
    })
    admin = await signIn('admin@romashka.ru', 'админ-пароль-1')
    engineer = await signIn('engineer@romashka.ru', 'инженер-пароль-1')
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('works out the last 30 days of the company’s notices, newest first', async () => {
    const notices = await list(admin)
    expect(notices.map((n) => [n.kind, n.requestId ?? n.productId, n.lead])).toEqual([
      ['planned_replacement', 'h1', 14],
      ['request_status', 'r1', null],
      ['overdue', 'h2', 0],
      ['planned_replacement', 'h1', 30],
      ['planned_replacement', 'h2', 7],
      ['planned_replacement', 'h2', 14],
    ])
    expect(notices[0]).toMatchObject({
      title: 'EHS 11 · НТ08',
      message: 'Плановая замена 17.10.2026 — через 14 дней. Пора заказать рукав',
      dueDate: '2026-10-17',
      read: false,
    })
    expect(notices[1]).toMatchObject({
      title: 'Заявка СВЦБ-000101',
      message: 'Выполнена в 1С',
      productId: 'h2',
      createdAt: '2026-10-01T10:00:00.000Z',
    })
    expect(notices[2].message).toBe('Срок эксплуатации вышел 20.09.2026 — рукав пора менять')
  })

  it('keeps what each person read, one by one or all at once', async () => {
    const [first] = await list(admin)
    const one = await call('POST', '/notifications/read', admin, { ids: [first.id] })
    expect(one.json()).toEqual({ unread: 5 })
    expect((await list(admin)).filter((n) => n.read).map((n) => n.id)).toEqual([first.id])
    // Another person of the company has read nothing.
    expect((await list(engineer)).every((n) => !n.read)).toBe(true)

    expect((await call('POST', '/notifications/read', admin, {})).json()).toEqual({ unread: 0 })
    expect((await list(admin)).every((n) => n.read)).toBe(true)
  })

  it('follows the person’s choice and the company’s lead days', async () => {
    expect((await call('GET', '/me/notification-prefs', engineer)).json()).toEqual({
      kinds: { overdue: true, planned_replacement: true, warranty_end: true, request_status: true },
      email: true,
      address: 'engineer@romashka.ru',
      companyEmail: false,
    })
    expect(
      (await call('PATCH', '/me/notification-prefs', engineer, { kinds: { bogus: true } }))
        .statusCode,
    ).toBe(400)
    const saved = await call('PATCH', '/me/notification-prefs', engineer, {
      kinds: { overdue: false },
      email: false,
    })
    expect(saved.json()).toMatchObject({
      kinds: { overdue: false, request_status: true },
      email: false,
    })
    expect((await list(engineer)).some((n) => n.kind === 'overdue')).toBe(false)
    expect((await list(admin)).some((n) => n.kind === 'overdue')).toBe(true)

    await call('PATCH', '/admin/settings', admin, { leadDays: [7] })
    expect((await list(admin)).map((n) => [n.kind, n.lead])).toEqual([
      ['request_status', null],
      ['overdue', 0],
      ['planned_replacement', 7],
    ])
  })
})
