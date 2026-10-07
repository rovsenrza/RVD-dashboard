// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { attemptLimiter } from './limiter.ts'
import { addUser } from './service.ts'

describe('the wrong-password limiter', () => {
  it('lets a key fail up to the limit, then makes it wait for the oldest failure to age out', () => {
    let now = 0
    const limit = attemptLimiter({ max: 3, windowMs: 60_000, now: () => now })
    for (const t of [0, 10_000, 20_000]) {
      now = t
      expect(limit.wait('a')).toBe(0)
      limit.fail('a')
    }
    expect(limit.wait('a')).toBe(40)
    expect(limit.wait('b')).toBe(0)
    now = 60_001
    expect(limit.wait('a')).toBe(0)
    limit.clear('a')
    expect(limit.wait('a')).toBe(0)
  })
})

describe.skipIf(!hasDb)('signing in against guessing', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>

  const login = (password: string) =>
    app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'Admin@Romashka.ru', password },
    })

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    await addUser(db, {
      company: 'ООО Ромашка',
      clientKey: 'k1',
      name: 'Админ',
      email: 'admin@romashka.ru',
      password: 'верный-пароль-1',
      role: 'admin',
    })
    app = buildApp({
      logLevel: 'silent',
      db,
      auth: {
        secret: 'a-test-secret-that-is-long-enough-1234567890',
        limits: { account: attemptLimiter({ max: 2, windowMs: 60_000 }) },
      },
    })
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('stops an account after its wrong passwords, even for the right one, and says how long', async () => {
    expect((await login('не-тот-1')).statusCode).toBe(401)
    expect((await login('не-тот-2')).statusCode).toBe(401)
    const blocked = await login('верный-пароль-1')
    expect(blocked.statusCode).toBe(429)
    expect(blocked.headers['retry-after']).toBe('60')
    expect(blocked.json().message).toBe('Слишком много неудачных попыток — попробуйте через 1 мин.')
  })

  it('answers with headers that keep data out of frames and caches', async () => {
    const res = await app.inject('/health')
    expect(res.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    })
  })
})
