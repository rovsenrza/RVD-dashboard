// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, DEFAULT_SETTINGS, type AuditEntry, type CabinetUser } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import { addUser } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { product } from '../test/rows.ts'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'

describe.skipIf(!hasDb)('company settings and the action log on the server', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let admin: string
  let engineer: string
  let theirAdmin: string

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) =>
    app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } })
  const signIn = async (email: string, password: string) =>
    (await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })).json()
      .accessToken as string
  const log = async (token: string) =>
    (await call('GET', '/admin/audit', token)).json() as AuditEntry[]

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    const romashka = { company: 'ООО Ромашка', clientKey: 'k1' }
    await addUser(db, {
      ...romashka,
      name: 'Админ Ромашки',
      email: 'admin@romashka.ru',
      password: 'админ-пароль-1',
      role: 'admin',
    })
    await addUser(db, {
      ...romashka,
      name: 'Инженер Ромашки',
      email: 'engineer@romashka.ru',
      password: 'инженер-пароль-1',
      role: 'engineer',
    })
    await addUser(db, {
      company: 'ООО Лютик',
      clientKey: 'k2',
      name: 'Админ Лютика',
      email: 'admin@lyutik.ru',
      password: 'лютик-пароль-1',
      role: 'admin',
    })
    // 149 days left of 365 on 03.10.2026, under warranty: fine by «last 30 days», «Внимание»
    // by «last 50 %».
    const hose = (id: string, serialNumber: string) =>
      product({
        id,
        serialNumber,
        shippedAt: '2026-03-01',
        lifecycle: 'shipped',
        warrantyDays: 365,
      })
    await storeCache(
      db,
      {
        products: [
          { product: hose('h1', '101'), clientId: 'k1' },
          { product: hose('h2', '201'), clientId: 'k2' },
        ],
      },
      1,
    )
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: '2026-10-03', rules: DEFAULT_RULES }),
      auth: { secret: SECRET },
    })
    admin = await signIn('admin@romashka.ru', 'админ-пароль-1')
    engineer = await signIn('engineer@romashka.ru', 'инженер-пароль-1')
    theirAdmin = await signIn('admin@lyutik.ru', 'лютик-пароль-1')
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('starts every company on the defaults and keeps settings to the administrator', async () => {
    expect((await call('GET', '/admin/settings', admin)).json()).toEqual(DEFAULT_SETTINGS)
    expect((await call('GET', '/admin/settings', engineer)).statusCode).toBe(403)
    expect((await call('PATCH', '/admin/settings', engineer, { warnDays: 10 })).statusCode).toBe(
      403,
    )
    expect((await call('GET', '/admin/audit', engineer)).statusCode).toBe(403)
  })

  it('refuses settings outside the form’s ranges and logs nothing', async () => {
    const odd = await call('PATCH', '/admin/settings', admin, { leadDays: [5] })
    expect(odd.statusCode).toBe(422)
    expect(odd.json().message).toMatch(/Предупреждать можно только за/)
    expect((await call('PATCH', '/admin/settings', admin, { warnPercent: 99 })).statusCode).toBe(
      422,
    )
    expect(await log(admin)).toEqual([])
  })

  it('reads every status by the company’s own rule, and only that company’s', async () => {
    const status = async (token: string, id: string) =>
      (await call('GET', `/products/${id}`, token)).json().status
    expect(await status(engineer, 'h1')).toBe('ok')

    const saved = await call('PATCH', '/admin/settings', admin, {
      warnRule: 'percent',
      warnPercent: 50,
      leadDays: [14, 7],
      ignored: true,
    })
    expect(saved.json()).toEqual({
      ...DEFAULT_SETTINGS,
      warnRule: 'percent',
      warnPercent: 50,
      leadDays: [14, 7],
    })
    expect(await status(engineer, 'h1')).toBe('warn')
    expect((await call('GET', '/dashboard/summary', engineer)).json().expiringSoon).toBe(1)
    // Another company keeps its own rule.
    expect(await status(theirAdmin, 'h2')).toBe('ok')
    expect((await call('GET', '/admin/settings', theirAdmin)).json()).toEqual(DEFAULT_SETTINGS)

    const [entry] = await log(admin)
    expect(entry).toMatchObject({
      action: 'settings.update',
      actor: { name: 'Админ Ромашки' },
      target: { kind: 'settings', id: null, label: 'Настройки компании' },
      changes: [
        {
          field: '«Внимание»',
          before: 'последние 30 дн. до плановой замены',
          after: 'последние 50 % срока эксплуатации',
        },
        { field: 'Предупреждать за, дней', before: '30, 14, 7', after: '14, 7' },
      ],
    })
    // Saving the same again changes nothing and writes nothing.
    await call('PATCH', '/admin/settings', admin, { warnPercent: 50 })
    expect(await log(admin)).toHaveLength(1)
  })

  it('logs what the administrator does to users, newest first, for their company only', async () => {
    const created = await call('POST', '/admin/users', admin, {
      name: 'Механик Ромашки',
      email: 'mechanic@romashka.ru',
      role: 'mechanic',
    })
    const user = created.json().user as CabinetUser
    await call('PATCH', `/admin/users/${user.id}`, admin, { role: 'engineer' })
    await call('POST', `/admin/users/${user.id}/reset-password`, admin)
    await call('PATCH', `/admin/users/${user.id}`, admin, { active: false })

    const entries = (await log(admin)).slice(0, 4)
    expect(entries.map((e) => e.action)).toEqual([
      'user.deactivate',
      'user.password',
      'user.update',
      'user.create',
    ])
    expect(entries.every((e) => e.target.id === user.id)).toBe(true)
    expect(entries[2].changes).toEqual([{ field: 'Роль', before: 'Механик', after: 'Инженер' }])
    expect(entries[3].changes).toContainEqual({
      field: 'Почта',
      before: null,
      after: 'mechanic@romashka.ru',
    })
    expect(await log(theirAdmin)).toEqual([])
  })

  it('logs a request with the hoses it names', async () => {
    const res = await call('POST', '/requests', engineer, {
      branchId: 'b1',
      kind: 'replace',
      positions: [
        {
          productId: 'h1',
          catalogNumberId: null,
          catalogNumber: null,
          equipmentId: null,
          quantity: 1,
        },
      ],
    })
    expect(res.statusCode).toBe(201)
    const [entry] = await log(admin)
    expect(entry).toMatchObject({
      action: 'request.create',
      actor: { name: 'Инженер Ромашки' },
      target: { kind: 'request', id: res.json().id, label: 'Новая заявка' },
      changes: [
        { field: 'Тип', before: null, after: 'Замена' },
        { field: 'Изделия', before: null, after: 'EHS 101' },
        { field: 'Количество', before: null, after: '1' },
      ],
    })
  })
})
