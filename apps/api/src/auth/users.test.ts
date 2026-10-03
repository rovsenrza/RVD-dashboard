// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, type CabinetUser, type UserCreated } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { addUser } from './service.ts'
import { temporaryPassword } from './users.ts'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'

describe('one-time passwords', () => {
  it('are three groups of four characters that cannot be misread', () => {
    const passwords = new Set(Array.from({ length: 50 }, temporaryPassword))
    expect(passwords.size).toBe(50)
    for (const p of passwords)
      expect(p).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]{4}(-[a-km-np-zA-HJ-NP-Z2-9]{4}){2}$/)
  })
})

describe.skipIf(!hasDb)('the company’s users, as its administrator manages them', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let admin: string
  let adminId: string

  type Answer = Awaited<ReturnType<typeof app.inject>>
  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, token?: string, payload?: object) =>
    app.inject({
      method,
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  const signIn = async (email: string, password: string) =>
    call('POST', '/auth/login', undefined, { email, password })
  const tokenOf = (res: Answer) => res.json().accessToken as string

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    const romashka = { company: 'ООО Ромашка', clientKey: 'k1' }
    adminId = await addUser(db, {
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
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: '2026-10-03', rules: DEFAULT_RULES }),
      auth: { secret: SECRET },
    })
    admin = tokenOf(await signIn('admin@romashka.ru', 'админ-пароль-1'))
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('lists only the administrator’s own company, and only to an administrator', async () => {
    const list = (await call('GET', '/admin/users', admin)).json() as CabinetUser[]
    expect(list.map((u) => u.email)).toEqual(['admin@romashka.ru', 'engineer@romashka.ru'])
    expect(list[0]).toMatchObject({ role: 'admin', active: true, branchIds: [] })

    const engineer = tokenOf(await signIn('engineer@romashka.ru', 'инженер-пароль-1'))
    expect((await call('GET', '/admin/users', engineer)).statusCode).toBe(403)
    expect((await call('GET', '/admin/users')).statusCode).toBe(401)
  })

  it('adds a user with a one-time password, which opens nothing but its own replacement', async () => {
    const res = await call('POST', '/admin/users', admin, {
      name: 'Петров Пётр',
      email: 'petrov@romashka.ru',
      role: 'mechanic',
      branchIds: ['ignored'],
    })
    expect(res.statusCode).toBe(201)
    const { user, delivery } = res.json() as UserCreated
    expect(user).toMatchObject({ name: 'Петров Пётр', role: 'mechanic', lastLoginAt: null })
    if (delivery.kind !== 'password') throw new Error('a one-time password was expected')

    const first = await signIn('petrov@romashka.ru', delivery.password)
    expect(first.json()).toMatchObject({ mustChangePassword: true })
    const temporary = tokenOf(first)
    expect((await call('GET', '/products', temporary)).statusCode).toBe(403)
    expect((await call('GET', '/me', temporary)).json()).toMatchObject({ mustChangePassword: true })

    const wrong = await call('POST', '/auth/password', temporary, {
      current: 'не-тот-пароль',
      next: 'мой-новый-пароль',
    })
    expect(wrong.statusCode).toBe(400)
    expect(wrong.json().message).toBe('Текущий пароль не подходит')
    const short = await call('POST', '/auth/password', temporary, {
      current: delivery.password,
      next: 'коротко',
    })
    expect(short.json().message).toMatch(/не короче 10/)

    const changed = await call('POST', '/auth/password', temporary, {
      current: delivery.password,
      next: 'мой-новый-пароль',
    })
    expect(changed.statusCode).toBe(200)
    expect(changed.json()).toMatchObject({ mustChangePassword: false })
    expect(String(changed.headers['set-cookie'])).toMatch(/^rvd_refresh=.+/)
    expect((await call('GET', '/products', tokenOf(changed))).statusCode).toBe(200)

    expect((await signIn('petrov@romashka.ru', delivery.password)).statusCode).toBe(401)
    expect((await signIn('petrov@romashka.ru', 'мой-новый-пароль')).statusCode).toBe(200)
  })

  it('refuses a taken e-mail and an incomplete user', async () => {
    const taken = await call('POST', '/admin/users', admin, {
      name: 'Двойник',
      email: 'ADMIN@lyutik.ru',
      role: 'engineer',
    })
    expect(taken.statusCode).toBe(409)
    expect((await call('POST', '/admin/users', admin, { name: 'Без почты' })).statusCode).toBe(400)
  })

  it('keeps an administrator from changing their own role or access, and from other companies', async () => {
    const own = await call('PATCH', `/admin/users/${adminId}`, admin, { role: 'engineer' })
    expect(own.statusCode).toBe(409)
    expect(
      (await call('PATCH', `/admin/users/${adminId}`, admin, { name: 'Главный админ' })).json(),
    ).toMatchObject({ name: 'Главный админ', role: 'admin' })

    const lyutik = tokenOf(await signIn('admin@lyutik.ru', 'лютик-пароль-1'))
    const theirs = await call('PATCH', `/admin/users/${adminId}`, lyutik, { active: false })
    expect(theirs.statusCode).toBe(404)
  })

  it('switches access off at once, and a reset hands out a new one-time password', async () => {
    const engineerId = ((await call('GET', '/admin/users', admin)).json() as CabinetUser[]).find(
      (u) => u.email === 'engineer@romashka.ru',
    )!.id
    const session = await signIn('engineer@romashka.ru', 'инженер-пароль-1')
    const cookie = String(session.headers['set-cookie']).split(';')[0]

    const off = await call('PATCH', `/admin/users/${engineerId}`, admin, { active: false })
    expect(off.json()).toMatchObject({ active: false })
    const renewed = await app.inject({ method: 'POST', url: '/auth/refresh', headers: { cookie } })
    expect(renewed.statusCode).toBe(401)
    expect((await signIn('engineer@romashka.ru', 'инженер-пароль-1')).statusCode).toBe(401)
    expect(
      (await call('POST', `/admin/users/${engineerId}/reset-password`, admin)).statusCode,
    ).toBe(409)

    await call('PATCH', `/admin/users/${engineerId}`, admin, { active: true })
    const reset = await call('POST', `/admin/users/${engineerId}/reset-password`, admin)
    expect(reset.json()).toMatchObject({ kind: 'password', password: expect.any(String) })
    expect((await signIn('engineer@romashka.ru', 'инженер-пароль-1')).statusCode).toBe(401)
    expect((await signIn('engineer@romashka.ru', reset.json().password)).json()).toMatchObject({
      mustChangePassword: true,
    })
  })
})
