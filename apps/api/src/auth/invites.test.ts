// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CabinetUser, PasswordDelivery, UserCreated } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import type { Mail } from '../mail/mail.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { addUser } from './service.ts'

describe.skipIf(!hasDb)('invitations by mail, once there is SMTP', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let admin: string
  const letters: Mail[] = []
  let mailDown = false

  const call = (method: 'GET' | 'POST', url: string, token?: string, payload?: object) =>
    app.inject({
      method,
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  const tokenFrom = (mail: Mail) => mail.text.match(/invite\?token=([\w-]+)/)![1]
  const signIn = async (email: string, password: string) =>
    call('POST', '/auth/login', undefined, { email, password })

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    await addUser(db, {
      company: 'ООО Ромашка',
      clientKey: 'k1',
      name: 'Админ',
      email: 'admin@r.ru',
      password: 'админ-пароль-1',
      role: 'admin',
    })
    app = buildApp({
      logLevel: 'silent',
      db,
      auth: { secret: 'a-test-secret-that-is-long-enough-1234567890' },
      mail: {
        cabinetUrl: 'https://clientrvd.vgiz.ru/',
        send: async (mail) => {
          if (mailDown) throw new Error('SMTP недоступен')
          letters.push(mail)
        },
      },
    })
    admin = (await signIn('admin@r.ru', 'админ-пароль-1')).json().accessToken
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('sends a new user a link instead of a password, and the link opens the cabinet', async () => {
    const created = (
      await call('POST', '/admin/users', admin, { name: 'Пётр', email: 'p@r.ru', role: 'engineer' })
    ).json() as UserCreated
    expect(created.delivery).toEqual({ kind: 'email', sentTo: 'p@r.ru' })
    const [letter] = letters
    expect(letter).toMatchObject({ to: 'p@r.ru', subject: 'Доступ в «РВД Кабинет»' })
    expect(letter.text).toContain('компании ООО Ромашка')
    expect(letter.text).toContain('https://clientrvd.vgiz.ru/invite?token=')
    const token = tokenFrom(letter)

    expect((await call('GET', `/auth/invite?token=${token}`)).json()).toEqual({
      name: 'Пётр',
      email: 'p@r.ru',
    })
    expect(
      (await call('POST', '/auth/invite', undefined, { token, password: 'коротко' })).statusCode,
    ).toBe(400)
    const accepted = await call('POST', '/auth/invite', undefined, {
      token,
      password: 'мой-собственный-пароль',
    })
    expect(accepted.statusCode).toBe(200)
    expect(accepted.json()).toMatchObject({ mustChangePassword: false, user: { email: 'p@r.ru' } })
    expect(accepted.headers['set-cookie']).toMatch(/rvd_refresh=/)
    expect((await signIn('p@r.ru', 'мой-собственный-пароль')).statusCode).toBe(200)

    // One use only.
    expect((await call('GET', `/auth/invite?token=${token}`)).statusCode).toBe(404)
    expect(
      (await call('POST', '/auth/invite', undefined, { token, password: 'ещё-один-пароль-1' }))
        .statusCode,
    ).toBe(404)
  })

  it('sends a reset as a link too, voiding the links sent before', async () => {
    const [user] = ((await call('GET', '/admin/users', admin)).json() as CabinetUser[]).filter(
      (u) => u.email === 'p@r.ru',
    )
    await call('POST', `/admin/users/${user.id}/reset-password`, admin)
    const first = tokenFrom(letters.at(-1)!)
    const delivery = (await call('POST', `/admin/users/${user.id}/reset-password`, admin)).json()
    expect(delivery).toEqual({ kind: 'email', sentTo: 'p@r.ru' })
    expect(letters.at(-1)!.subject).toBe('Новый пароль для «РВД Кабинета»')
    expect((await call('GET', `/auth/invite?token=${first}`)).statusCode).toBe(404)
    expect((await call('GET', `/auth/invite?token=${tokenFrom(letters.at(-1)!)}`)).statusCode).toBe(
      200,
    )
  })

  it('falls back to the one-time password when the letter cannot go', async () => {
    mailDown = true
    const created = (
      await call('POST', '/admin/users', admin, { name: 'Иван', email: 'i@r.ru', role: 'mechanic' })
    ).json() as UserCreated
    mailDown = false
    const delivery: PasswordDelivery = created.delivery
    expect(delivery.kind).toBe('password')
  })
})
