// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, type Equipment, type Product } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { machine, product } from '../test/rows.ts'
import { signJwt, verifyJwt } from './jwt.ts'
import { hashPassword, verifyPassword } from './password.ts'
import { addUser, refresh as renewSession } from './service.ts'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'

describe('passwords and tokens', () => {
  it('hashes with a fresh salt and verifies only the right password', async () => {
    const [a, b] = await Promise.all([hashPassword('пароль-123456'), hashPassword('пароль-123456')])
    expect(a).not.toBe(b)
    expect(await verifyPassword('пароль-123456', a)).toBe(true)
    expect(await verifyPassword('пароль-123457', a)).toBe(false)
  })

  it('accepts only an untouched, unexpired token signed with the secret', () => {
    const exp = Math.floor(Date.now() / 1000) + 60
    const token = signJwt({ sub: 'u1', exp }, SECRET)
    expect(verifyJwt(token, SECRET)).toMatchObject({ sub: 'u1' })
    expect(verifyJwt(token, `${SECRET}x`)).toBeNull()
    const [h, , s] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp })).toString('base64url')
    expect(verifyJwt(`${h}.${forged}.${s}`, SECRET)).toBeNull()
    expect(verifyJwt(token, SECRET, (exp + 1) * 1000)).toBeNull()
  })
})

describe.skipIf(!hasDb)('sign-in and one company’s data', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    await storeCache(
      db,
      {
        products: [
          {
            product: product({ id: 'mine', equipmentId: 'eq-mine', shippedAt: '2026-09-01' }),
            clientId: 'k1',
          },
          { product: product({ id: 'theirs', shippedAt: '2026-09-01' }), clientId: 'k2' },
        ],
        equipment: [
          { equipment: machine('eq-mine'), clientId: 'k1' },
          { equipment: machine('eq-theirs'), clientId: 'k2' },
        ],
      },
      1,
    )
    const base = { company: 'ООО Ромашка', clientKey: 'k1', role: 'engineer' as const }
    await addUser(db, {
      ...base,
      name: 'Иванов Иван',
      email: 'ivanov@example.ru',
      password: 'верный-пароль-1',
    })
    await addUser(db, {
      ...base,
      name: 'Уволен',
      email: 'gone@example.ru',
      password: 'верный-пароль-2',
    })
    await db.query(`update users set active = false where email = 'gone@example.ru'`)
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: '2026-09-30', rules: DEFAULT_RULES }),
      auth: { secret: SECRET },
    })
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  const signIn = (email: string, password: string) =>
    app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })
  const cookieOf = (res: { headers: Record<string, unknown> }) =>
    String(res.headers['set-cookie']).split(';')[0]
  const as = (token: string, url: string) =>
    app.inject({ url, headers: { authorization: `Bearer ${token}` } })

  it('lets nobody in without a token, and no one in with a wrong password or a closed account', async () => {
    expect((await app.inject('/products')).statusCode).toBe(401)
    expect((await app.inject('/health')).statusCode).toBe(200)
    expect((await signIn('ivanov@example.ru', 'не-тот')).statusCode).toBe(401)
    expect((await signIn('nobody@example.ru', 'верный-пароль-1')).statusCode).toBe(401)
    expect((await signIn('gone@example.ru', 'верный-пароль-2')).statusCode).toBe(401)
  })

  it('signs in and shows the company only its own 1С client’s hoses, machines and totals', async () => {
    const res = await signIn('IVANOV@example.ru', 'верный-пароль-1')
    expect(res.statusCode).toBe(200)
    const { accessToken, user, company } = res.json()
    expect(user).toMatchObject({ name: 'Иванов Иван', role: 'engineer' })
    expect(company).toMatchObject({ name: 'ООО Ромашка' })
    expect(cookieOf(res)).toMatch(/^rvd_refresh=.+/)

    const ids = (await as(accessToken, '/products?client=k2'))
      .json()
      .items.map((p: Product) => p.id)
    expect(ids).toEqual(['mine'])
    expect((await as(accessToken, '/products/theirs')).statusCode).toBe(404)
    expect((await as(accessToken, '/products/theirs/history')).statusCode).toBe(404)
    expect((await as(accessToken, '/equipment')).json().map((e: Equipment) => e.id)).toEqual([
      'eq-mine',
    ])
    expect((await as(accessToken, '/equipment/eq-theirs')).statusCode).toBe(404)
    expect((await as(accessToken, '/dashboard/summary')).json().shippedTotal).toBe(1)
    expect((await as(accessToken, '/me')).json()).toMatchObject({
      user: { email: 'ivanov@example.ru' },
    })
  })

  const refresh = (cookie: string) =>
    app.inject({ method: 'POST', url: '/auth/refresh', headers: { cookie } })

  it('trades a refresh token once, and none after sign-out', async () => {
    const first = cookieOf(await signIn('ivanov@example.ru', 'верный-пароль-1'))

    const renewed = await refresh(first)
    expect(renewed.statusCode).toBe(200)
    expect(renewed.json().accessToken).toBeTruthy()
    const second = cookieOf(renewed)
    expect(second).not.toBe(first)

    // Spent a moment ago: still answered, without a new token, while its successor lives.
    const raced = await refresh(first)
    expect(raced.statusCode).toBe(200)
    expect(raced.json().accessToken).toBeTruthy()
    expect(raced.headers['set-cookie']).toBeUndefined()

    await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie: second } })
    expect((await refresh(second)).statusCode).toBe(401)
    expect((await refresh(first)).statusCode).toBe(401) // its successor is signed out
  })

  it('lets two requests with one token both through, and rotates it once', async () => {
    const cookie = cookieOf(await signIn('ivanov@example.ru', 'верный-пароль-1'))
    const answers = await Promise.all([refresh(cookie), refresh(cookie), refresh(cookie)])
    expect(answers.map((a) => a.statusCode)).toEqual([200, 200, 200])
    expect(answers.filter((a) => a.headers['set-cookie'])).toHaveLength(1)
  })

  it('stops answering a spent token after a few seconds', async () => {
    const token = cookieOf(await signIn('ivanov@example.ru', 'верный-пароль-1')).split('=')[1]
    const now = new Date()
    expect(await renewSession(db, SECRET, token, now)).toMatchObject({
      refreshToken: expect.any(String),
    })
    expect(await renewSession(db, SECRET, token, new Date(now.getTime() + 5_000))).toMatchObject({
      refreshToken: null,
    })
    expect(await renewSession(db, SECRET, token, new Date(now.getTime() + 60_000))).toBeNull()
  })
})
