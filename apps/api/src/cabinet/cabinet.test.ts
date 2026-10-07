// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_RULES,
  type AuditEntry,
  type Product,
  type ProductComment,
  type ProductPage,
} from '@rvd/contracts'
import { buildApp } from '../app.ts'
import { addUser } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { storeCache, type Cache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { machine, product } from '../test/rows.ts'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'

describe.skipIf(!hasDb)('what the customer alone knows, kept by the server', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let admin: string
  let engineer: string
  let mechanic: string

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    token: string,
    payload?: object,
  ) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } })
  const log = async () => (await call('GET', '/admin/audit', admin)).json() as AuditEntry[]

  const cache: Cache = {
    products: [
      {
        product: product({
          id: 'h1',
          serialNumber: '101',
          equipmentId: 'e1',
          shippedAt: '2026-05-01',
        }),
        clientId: 'k1',
      },
      {
        product: product({ id: 'x1', serialNumber: '901', shippedAt: '2026-05-01' }),
        clientId: 'k2',
      },
    ],
    equipment: [
      { equipment: machine('e1', { garageNumber: 'НТ08' }), clientId: 'k1' },
      { equipment: machine('e2', { garageNumber: 'ЕХ20' }), clientId: 'k1' },
    ],
  }

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    const company = { company: 'ООО Ромашка', clientKey: 'k1' }
    for (const [name, email, role] of [
      ['Админ', 'a@r.ru', 'admin'],
      ['Инженер', 'e@r.ru', 'engineer'],
      ['Механик', 'm@r.ru', 'mechanic'],
    ] as const)
      await addUser(db, { ...company, name, email, password: `${role}-пароль-1`, role })
    await storeCache(db, cache, 1)
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: '2026-10-03', rules: DEFAULT_RULES }),
      auth: { secret: SECRET },
    })
    const signIn = async (email: string, password: string) =>
      (
        await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })
      ).json().accessToken as string
    admin = await signIn('a@r.ru', 'admin-пароль-1')
    engineer = await signIn('e@r.ru', 'engineer-пароль-1')
    mechanic = await signIn('m@r.ru', 'mechanic-пароль-1')
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('keeps where a hose sits and its own number through every sync, and finds it by them', async () => {
    const saved = await call('PATCH', '/products/h1', engineer, {
      installPlace: 'Стрела',
      clientNumber: 'K-1042',
    })
    expect(saved.json()).toMatchObject({ installPlace: 'Стрела', clientNumber: 'K-1042' })
    const found = async () =>
      ((await call('GET', '/products?q=k-1042', engineer)).json() as ProductPage).items.map(
        (p) => p.id,
      )
    expect(await found()).toEqual(['h1'])

    await storeCache(db, cache, 1)
    expect((await call('GET', '/products/h1', engineer)).json()).toMatchObject({
      installPlace: 'Стрела',
      clientNumber: 'K-1042',
    })
    expect(await found()).toEqual(['h1'])

    const [entry] = await log()
    expect(entry).toMatchObject({
      action: 'installation.update',
      actor: { name: 'Инженер' },
      target: { label: 'EHS 101' },
      changes: [
        { field: 'Место установки', before: null, after: 'Стрела' },
        { field: 'Внутренний №', before: null, after: 'K-1042' },
      ],
    })
  })

  it('leaves the machine and the date to the supplier, and another client’s hose alone', async () => {
    const moved = await call('PATCH', '/products/h1', engineer, { equipmentId: 'e2' })
    expect(moved.statusCode).toBe(409)
    expect(moved.json().message).toMatch(/меняет специалист/)
    // Sending the machine it is already on is no move.
    expect((await call('PATCH', '/products/h1', engineer, { equipmentId: 'e1' })).statusCode).toBe(
      200,
    )
    expect(
      (await call('PATCH', '/products/h1', engineer, { installedAt: '2026-06-01' })).statusCode,
    ).toBe(400)
    expect((await call('PATCH', '/products/x1', engineer, { clientNumber: 'X' })).statusCode).toBe(
      404,
    )
  })

  it('keeps notes: anyone adds, only the author edits, the author or an administrator removes', async () => {
    const added = await call('POST', '/products/h1/comments', mechanic, {
      text: '  Течь у фитинга ',
    })
    expect(added.statusCode).toBe(201)
    const note = added.json() as ProductComment
    expect(note).toMatchObject({
      text: 'Течь у фитинга',
      author: { name: 'Механик', role: 'mechanic' },
    })
    expect((await call('POST', '/products/h1/comments', mechanic, { text: ' ' })).statusCode).toBe(
      422,
    )

    expect(
      (await call('PATCH', `/comments/${note.id}`, engineer, { text: 'Чужое' })).statusCode,
    ).toBe(403)
    const edited = await call('PATCH', `/comments/${note.id}`, mechanic, { text: 'Течь устранена' })
    expect(edited.json()).toMatchObject({ text: 'Течь устранена' })
    expect(edited.json().editedAt).not.toBeNull()

    expect((await call('DELETE', `/comments/${note.id}`, engineer)).statusCode).toBe(403)
    expect((await call('DELETE', `/comments/${note.id}`, admin)).statusCode).toBe(204)
    expect((await call('GET', '/products/h1/comments', engineer)).json()).toEqual([])
    expect((await log()).slice(0, 3).map((e) => e.action)).toEqual([
      'comment.delete',
      'comment.update',
      'comment.create',
    ])
  })

  it('takes a message for the specialist by the form’s rule and keeps it to pass on', async () => {
    const future = await call('POST', '/support/messages', engineer, {
      topic: 'install_date',
      productId: 'h1',
      installedAt: '2027-01-01',
      text: '',
    })
    expect(future.statusCode).toBe(400)
    const sent = await call('POST', '/support/messages', engineer, {
      topic: 'install_date',
      productId: 'h1',
      installedAt: '2026-05-10',
      text: 'Поставили через неделю',
    })
    expect(sent.statusCode).toBe(201)
    const { rows } = await db.query(
      'select author_email, topic, installed_at::text, delivered_at from support_messages',
    )
    expect(rows).toEqual([
      {
        author_email: 'e@r.ru',
        topic: 'install_date',
        installed_at: '2026-05-10',
        delivered_at: null,
      },
    ])
    const [entry] = await log()
    expect(entry).toMatchObject({
      action: 'support.message',
      changes: [
        { field: 'Тема', after: 'Исправить дату установки' },
        { field: 'Дата установки', before: '01.05.2026', after: '10.05.2026' },
        { field: 'Сообщение', after: 'Поставили через неделю' },
      ],
    })
  })

  it('keeps a machine’s department and factory number through every sync', async () => {
    const saved = await call('PATCH', '/equipment/e1', engineer, {
      department: ' Карьер № 2 ',
      factoryNumber: 'ZX-0042',
    })
    expect(saved.json()).toMatchObject({ department: 'Карьер № 2', factoryNumber: 'ZX-0042' })
    await storeCache(db, cache, 1)
    expect((await call('GET', '/equipment/e1', engineer)).json()).toMatchObject({
      department: 'Карьер № 2',
      factoryNumber: 'ZX-0042',
    })
    const [entry] = await log()
    expect(entry).toMatchObject({
      action: 'equipment.update',
      target: { kind: 'equipment', id: 'e1', label: 'НТ08' },
      changes: [
        { field: 'Подразделение', before: null, after: 'Карьер № 2' },
        { field: 'Заводской №', before: null, after: 'ZX-0042' },
      ],
    })
    // The garage number is the supplier's; another client's machine is not there at all.
    expect((await call('PATCH', '/equipment/e1', engineer, { garageNumber: 'X' })).statusCode).toBe(
      400,
    )
    expect((await call('PATCH', '/equipment/zz', engineer, { department: 'X' })).statusCode).toBe(
      404,
    )
  })

  it('never shows another client’s hose through its notes', async () => {
    expect((await call('GET', '/products/x1/comments', engineer)).statusCode).toBe(404)
    // No documentation is published by 1С yet: an empty list, not the demo's sample.
    expect((await call('GET', '/products/h1/documentation', engineer)).json()).toEqual([])
    expect((await call('GET', '/products/x1/documentation', engineer)).statusCode).toBe(404)
    const before: Product = (await call('GET', '/products/h1', engineer)).json()
    expect(before.id).toBe('h1')
  })
})
