// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_RULES,
  type BranchSummary,
  type CabinetUser,
  type ProductPage,
  type SignedIn,
} from '@rvd/contracts'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { machine, product } from '../test/rows.ts'
import { signJwt } from './jwt.ts'
import { addBranch, addUser } from './service.ts'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'

/**
 * A large customer is several clients in 1С, one per site (customer, 2026-10-08): the
 * company sees them all, a person bound to one sees that one, and the header's branch
 * narrows the view without ever widening it.
 */
describe.skipIf(!hasDb)('a company of several 1С clients, its branches', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let admin: SignedIn
  let siteHead: SignedIn

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) =>
    app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } })
  const signIn = async (email: string, password: string) =>
    (
      await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })
    ).json() as SignedIn
  const serials = async (url: string, token: string) =>
    ((await call('GET', url, token)).json() as ProductPage).items.map((p) => p.serialNumber).sort()

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    const company = { company: 'АО «Медь»', clientKey: 'head' }
    await addUser(db, {
      ...company,
      name: 'Главный механик',
      email: 'chief@med.ru',
      password: 'главный-пароль-1',
      role: 'admin',
    })
    await addBranch(db, { companyKey: 'head', clientKey: 'site', name: 'Участок' })
    await addUser(db, {
      ...company,
      name: 'Начальник участка',
      email: 'site@med.ru',
      password: 'участок-пароль-1',
      role: 'engineer',
      branchKeys: ['site'],
    })
    await addUser(db, {
      company: 'ООО Чужие',
      clientKey: 'other',
      name: 'Чужой',
      email: 'other@else.ru',
      password: 'чужой-пароль-1',
      role: 'admin',
    })
    await storeCache(
      db,
      {
        products: [
          {
            product: product({ id: 'h1', serialNumber: '101', branchId: 'head' }),
            clientId: 'head',
          },
          {
            product: product({ id: 'h2', serialNumber: '201', branchId: 'site' }),
            clientId: 'site',
          },
          {
            product: product({ id: 'h3', serialNumber: '301', branchId: 'other' }),
            clientId: 'other',
          },
        ],
        equipment: [{ equipment: machine('m1', { branchId: 'site' }), clientId: 'site' }],
      },
      1,
    )
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: '2026-10-08', rules: DEFAULT_RULES }),
      auth: { secret: SECRET },
    })
    admin = await signIn('chief@med.ru', 'главный-пароль-1')
    siteHead = await signIn('site@med.ru', 'участок-пароль-1')
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('names the branches a person works in when they sign in', async () => {
    expect(admin.branches.map((b) => b.name)).toEqual(['АО «Медь»', 'Участок'])
    expect(siteHead.branches).toEqual([
      { id: 'site', name: 'Участок', companyId: admin.company.id },
    ])
    const me = (await call('GET', '/me', siteHead.accessToken)).json() as SignedIn
    expect(me.branches.map((b) => b.id)).toEqual(['site'])
  })

  it('shows the company every branch, one branch when asked, and never another company', async () => {
    expect(await serials('/products', admin.accessToken)).toEqual(['101', '201'])
    expect(await serials('/products?branch=site', admin.accessToken)).toEqual(['201'])
    // A branch that is not theirs narrows nothing — and opens nothing.
    expect(await serials('/products?branch=other', admin.accessToken)).toEqual(['101', '201'])
    expect((await call('GET', '/products/h3', admin.accessToken)).statusCode).toBe(404)
  })

  it('keeps a person bound to a branch inside it', async () => {
    expect(await serials('/products', siteHead.accessToken)).toEqual(['201'])
    expect(await serials('/products?branch=head', siteHead.accessToken)).toEqual(['201'])
    expect((await call('GET', '/products/h1', siteHead.accessToken)).statusCode).toBe(404)
    const machines = (await call('GET', '/equipment', siteHead.accessToken)).json() as unknown[]
    expect(machines).toHaveLength(1)
  })

  it('lists the branches with what each holds', async () => {
    const list = (await call('GET', '/admin/branches', admin.accessToken)).json() as BranchSummary[]
    expect(list.map((b) => [b.name, b.productCount, b.equipmentCount, b.userCount])).toEqual([
      ['АО «Медь»', 1, 0, 1],
      ['Участок', 1, 1, 2],
    ])
    expect((await call('GET', '/admin/branches', siteHead.accessToken)).statusCode).toBe(403)
  })

  it('binds users to the company’s own branches, a mechanic to exactly one', async () => {
    const add = (payload: object) => call('POST', '/admin/users', admin.accessToken, payload)
    const person = { name: 'Механик', email: 'mech@med.ru', role: 'mechanic' }
    expect((await add({ ...person, branchIds: [] })).statusCode).toBe(400)
    expect((await add({ ...person, branchIds: ['head', 'site'] })).statusCode).toBe(400)
    expect((await add({ ...person, branchIds: ['other'] })).statusCode).toBe(400)
    const created = await add({ ...person, branchIds: ['site'] })
    expect(created.statusCode).toBe(201)
    const user = (created.json() as { user: CabinetUser }).user
    expect(user.branchIds).toEqual(['site'])

    // A new role keeps the branches unless new ones come with it.
    const moved = await call('PATCH', `/admin/users/${user.id}`, admin.accessToken, {
      role: 'engineer',
      branchIds: [],
    })
    expect((moved.json() as CabinetUser).branchIds).toEqual([])
    expect(
      (await call('PATCH', `/admin/users/${user.id}`, admin.accessToken, { role: 'mechanic' }))
        .statusCode,
    ).toBe(400)
  })

  it('takes a request for one branch at a time', async () => {
    const ask = (payload: object, token = admin.accessToken) =>
      call('POST', '/requests', token, { comment: null, ...payload })
    const replace = (ids: string[]) => ({
      branchId: '',
      kind: 'replace',
      positions: ids.map((productId) => ({
        productId,
        catalogNumberId: null,
        catalogNumber: null,
        equipmentId: null,
        quantity: 1,
      })),
    })
    expect((await ask(replace(['h1', 'h2']))).json().message).toMatch(/одного филиала/)
    expect((await ask(replace(['h2']))).json()).toMatchObject({ branchId: 'site' })

    const make = (branchId: string) => ({
      branchId,
      kind: 'manufacture',
      positions: [
        {
          productId: null,
          catalogNumberId: null,
          catalogNumber: 'X1',
          equipmentId: null,
          quantity: 1,
        },
      ],
    })
    expect((await ask(make(''))).json().message).toBe('Выберите филиал, для которого заявка')
    expect((await ask(make('other'))).statusCode).toBe(400)
    expect((await ask(make('head'))).json()).toMatchObject({ branchId: 'head' })
    // One branch of one's own needs no naming.
    expect((await ask(make(''), siteHead.accessToken)).json()).toMatchObject({ branchId: 'site' })
  })

  it('never hands another company’s client over as a branch', async () => {
    await expect(
      addBranch(db, { companyKey: 'head', clientKey: 'other', name: 'Чужой' }),
    ).rejects.toThrow(/другой компании/)
    await expect(
      addBranch(db, { companyKey: 'nobody', clientKey: 'x', name: 'X' }),
    ).rejects.toThrow(/Нет компании/)
  })

  it('treats a token from before branches as no token', async () => {
    const now = Math.floor(Date.now() / 1000)
    const old = signJwt(
      {
        sub: 'u',
        name: 'Старый',
        email: 'old@med.ru',
        role: 'admin',
        cid: 'c',
        cname: 'АО «Медь»',
        ck: 'head',
        iat: now,
        exp: now + 600,
      },
      SECRET,
    )
    expect((await call('GET', '/products', old)).statusCode).toBe(401)
  })
})
