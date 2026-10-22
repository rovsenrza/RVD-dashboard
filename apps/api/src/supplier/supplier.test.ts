// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CabinetUser, SignedIn, SupplierCompany } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import { addUser } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import type { Mail } from '../mail/mail.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { addStaff, mailboxFor } from './supplier.ts'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'
const [K1, K2, K3] = ['k1', 'k2', 'k3']
const NORTH = 'filial-north'

describe.skipIf(!hasDb)('the supplier’s section (customer, 2026-10-22)', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  const letters: Mail[] = []
  const moved: string[] = []
  // 1С answers only at its new address; anything else is a server that is not there.
  const fake1c = (async (url: string | URL) => {
    if (String(url).startsWith('https://new.1c.test/base/odata/'))
      return new Response(JSON.stringify({ value: [{ Ref_Key: K1 }] }), { status: 200 })
    throw new TypeError('fetch failed')
  }) as typeof fetch

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    url: string,
    token?: string,
    payload?: unknown,
    cookie?: string,
  ) =>
    app.inject({
      method,
      url,
      payload: payload as object,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { cookie } : {}),
      },
    })
  const cookieOf = (res: { headers: Record<string, unknown> }) =>
    String(res.headers['set-cookie']).split(';')[0]
  const signIn = async (email: string, password: string) => {
    const res = await call('POST', '/auth/login', undefined, { email, password })
    return { body: res.json() as SignedIn, cookie: cookieOf(res), status: res.statusCode }
  }

  let staff: SignedIn & { cookie: string }

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    await db.query(
      `insert into onec_snapshots (entity, rows) values
         ('Catalog_Клиенты', $1::jsonb), ('Catalog_Филиалы', $2::jsonb)`,
      [
        JSON.stringify([
          { Ref_Key: K1, Description: 'Разрез Северный', ИНН: '111', Филиал_Key: NORTH },
          { Ref_Key: K2, Description: 'Разрез Южный ', Филиал_Key: NORTH },
          {
            Ref_Key: K3,
            Description: 'Автобаза',
            Филиал_Key: '00000000-0000-0000-0000-000000000000',
          },
        ]),
        JSON.stringify([{ Ref_Key: NORTH, Description: 'Северный филиал' }]),
      ],
    )
    await addStaff(db, { name: 'Мастер', email: 'master@vgiz.ru', password: 'мастер-пароль-1' })
    app = buildApp({
      logLevel: 'silent',
      db,
      auth: { secret: SECRET },
      mail: { cabinetUrl: 'https://cabinet.test', send: async (m) => void letters.push(m) },
      onec: {
        fallbackUrl: 'https://old.1c.test/base/odata/standard.odata',
        user: 'u',
        password: 'p',
        fetch: fake1c,
        moveTo: (url) => void moved.push(url),
      },
    })
    const s = await signIn('master@vgiz.ru', 'мастер-пароль-1')
    staff = { ...s.body, cookie: s.cookie }
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('lets only staff in, and gives staff no company’s data of its own', async () => {
    expect(staff).toMatchObject({ staff: true, actingBy: null, branches: [] })
    expect((await call('GET', '/products', staff.accessToken)).json()).toMatchObject({ total: 0 })
    await addUser(db, {
      company: 'Чужая',
      clientKey: 'other',
      name: 'Клиент',
      email: 'client@x.ru',
      password: 'клиент-пароль-1',
      role: 'admin',
    })
    const client = await signIn('client@x.ru', 'клиент-пароль-1')
    expect(client.body.staff).toBe(false)
    expect((await call('GET', '/supplier/companies', client.body.accessToken)).statusCode).toBe(403)
  })

  it('registers a company from 1С clients, each a branch, and invites its administrator', async () => {
    const clients = (await call('GET', '/supplier/clients', staff.accessToken)).json()
    expect(clients.map((c: { name: string }) => c.name)).toEqual([
      'Автобаза',
      'Разрез Северный',
      'Разрез Южный',
    ])
    const res = await call('POST', '/supplier/companies', staff.accessToken, {
      name: 'ООО Разрезы',
      clientKeys: [K1, K2],
      admin: { name: 'Админ Разрезов', email: 'boss@razrez.ru' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().delivery).toEqual({ kind: 'email', sentTo: 'boss@razrez.ru' })
    expect(letters.at(-1)!.text).toContain('компании ООО Разрезы')
    // A client already taken is refused, and no company is left behind.
    const again = await call('POST', '/supplier/companies', staff.accessToken, {
      name: 'Дубль',
      clientKeys: [K2],
      admin: { name: 'X', email: 'x@x.ru' },
    })
    expect(again.statusCode).toBe(409)
    const companies = (await call('GET', '/supplier/companies', staff.accessToken)).json()
    const razrez = companies.find((c: SupplierCompany) => c.name === 'ООО Разрезы')
    expect(razrez.branches.map((b: { name: string }) => b.name)).toEqual([
      'Разрез Северный',
      'Разрез Южный',
    ])
    expect(companies.map((c: SupplierCompany) => c.name)).not.toContain('Дубль')
    expect(companies.map((c: SupplierCompany) => c.name)).not.toContain('ВГИЗ')
  })

  it('looks at a company as its hidden administrator, kept through renewals, then comes back', async () => {
    const razrez = (
      (await call('GET', '/supplier/companies', staff.accessToken)).json() as SupplierCompany[]
    ).find((c) => c.name === 'ООО Разрезы')!
    const act = await call(
      'POST',
      '/auth/act',
      staff.accessToken,
      { companyId: razrez.id },
      staff.cookie,
    )
    expect(act.statusCode).toBe(200)
    const as = act.json() as SignedIn
    expect(as).toMatchObject({
      actingBy: 'Мастер',
      staff: false,
      company: { name: 'ООО Разрезы' },
      user: { role: 'admin' },
    })
    expect(as.branches).toHaveLength(2)
    // Not among the company's people.
    const people = (await call('GET', '/admin/users', as.accessToken)).json() as CabinetUser[]
    expect(people.map((p) => p.email)).toEqual(['boss@razrez.ru'])
    // The old sign-in is spent; the new one renews into the same view.
    expect(
      (await call('POST', '/auth/refresh', undefined, undefined, staff.cookie)).statusCode,
    ).toBe(401)
    const renewed = await call('POST', '/auth/refresh', undefined, undefined, cookieOf(act))
    expect(renewed.json()).toMatchObject({ actingBy: 'Мастер', company: { name: 'ООО Разрезы' } })
    // Nor does the section open from inside the view.
    expect((await call('GET', '/supplier/companies', as.accessToken)).statusCode).toBe(403)
    const back = await call('POST', '/auth/act/stop', as.accessToken, undefined, cookieOf(renewed))
    expect(back.json()).toMatchObject({ staff: true, actingBy: null })
    staff = { ...(back.json() as SignedIn), cookie: cookieOf(back) }
  })

  it('looks as one of the company’s people, and logs what it does under both names', async () => {
    const razrez = (
      (await call('GET', '/supplier/companies', staff.accessToken)).json() as SupplierCompany[]
    ).find((c) => c.name === 'ООО Разрезы')!
    const boss = razrez.users[0]
    const act = await call(
      'POST',
      '/auth/act',
      staff.accessToken,
      { companyId: razrez.id, userId: boss.id },
      staff.cookie,
    )
    const as = act.json() as SignedIn
    // The person's one-time password is theirs to replace, not the staff member's.
    expect(as).toMatchObject({ user: { name: 'Админ Разрезов' }, mustChangePassword: false })
    expect(
      (await call('POST', '/auth/password', as.accessToken, { current: 'x', next: 'y'.repeat(12) }))
        .statusCode,
    ).toBe(403)
    await call('PATCH', '/admin/settings', as.accessToken, { warnDays: 45 })
    const { rows } = await db.query<{ actor_name: string }>(
      `select actor_name from audit_log where company_id = $1 order by at desc limit 1`,
      [razrez.id],
    )
    expect(rows[0].actor_name).toBe('Админ Разрезов (вход сотрудника поставщика: Мастер)')
    const back = await call('POST', '/auth/act/stop', as.accessToken, undefined, cookieOf(act))
    staff = { ...(back.json() as SignedIn), cookie: cookieOf(back) }
  })

  it('switches a company off: its people are out, and back on', async () => {
    const razrez = (
      (await call('GET', '/supplier/companies', staff.accessToken)).json() as SupplierCompany[]
    ).find((c) => c.name === 'ООО Разрезы')!
    const token = (await call('GET', `/auth/invite?token=x`)).statusCode
    expect(token).toBe(404)
    await call('PATCH', `/supplier/companies/${razrez.id}`, staff.accessToken, { active: false })
    await db.query(`update users set password_hash = (select password_hash from users
      where email = 'client@x.ru') where email = 'boss@razrez.ru'`)
    expect((await signIn('boss@razrez.ru', 'клиент-пароль-1')).status).toBe(401)
    expect(
      (await call('POST', '/auth/act', staff.accessToken, { companyId: razrez.id }, staff.cookie))
        .statusCode,
    ).toBe(404)
    await call('PATCH', `/supplier/companies/${razrez.id}`, staff.accessToken, { active: true })
    expect((await signIn('boss@razrez.ru', 'клиент-пароль-1')).status).toBe(200)
  })

  it('sends «Забыли пароль?» only to the supplier’s own domains, and says nothing either way', async () => {
    const before = letters.length
    for (const email of ['boss@razrez.ru', 'nobody@vgiz.ru'])
      expect((await call('POST', '/auth/forgot', undefined, { email })).statusCode).toBe(204)
    expect(letters).toHaveLength(before)
    expect(
      (await call('POST', '/auth/forgot', undefined, { email: 'MASTER@vgiz.ru' })).statusCode,
    ).toBe(204)
    expect(letters.at(-1)).toMatchObject({ to: 'master@vgiz.ru' })
    expect(letters.at(-1)!.text).toContain('вы попросили задать новый пароль')
  })

  it('adds staff of the supplier’s domains only', async () => {
    const bad = await call('POST', '/admin/users', staff.accessToken, {
      name: 'Менеджер',
      email: 'm@gmail.com',
      role: 'admin',
    })
    expect(bad.statusCode).toBe(400)
    const good = await call('POST', '/admin/users', staff.accessToken, {
      name: 'Менеджер',
      email: 'm@snabsv.ru',
      role: 'admin',
    })
    expect(good.statusCode).toBe(201)
  })

  it('sends a client’s letters to its supplier branch’s mailbox, else the general one', async () => {
    const saved = await call('PUT', '/supplier/mailboxes', staff.accessToken, [
      { filialId: '', requestsEmail: 'all@vgiz.ru', supportEmail: '' },
      { filialId: NORTH, requestsEmail: 'north@vgiz.ru', supportEmail: 'north-help@vgiz.ru' },
    ])
    expect(saved.json().map((m: { name: string }) => m.name)).toEqual([
      'Общий ящик',
      'Северный филиал',
    ])
    expect(await mailboxFor(db, K1, 'requests', 'env@vgiz.ru')).toBe('north@vgiz.ru')
    expect(await mailboxFor(db, K3, 'requests', 'env@vgiz.ru')).toBe('all@vgiz.ru')
    expect(await mailboxFor(db, K1, 'support', 'env@vgiz.ru')).toBe('north-help@vgiz.ru')
    // No general support address: the server's own.
    expect(await mailboxFor(db, K3, 'support', 'env@vgiz.ru')).toBe('env@vgiz.ru')
    expect(
      (
        await call('PUT', '/supplier/mailboxes', staff.accessToken, [
          { filialId: '', requestsEmail: 'не почта' },
        ])
      ).statusCode,
    ).toBe(400)
  })

  it('moves the cabinet to 1С’s new address only once it answers there', async () => {
    const get = async () => (await call('GET', '/supplier/onec', staff.accessToken)).json()
    expect(await get()).toEqual({
      url: 'https://old.1c.test/base/odata/standard.odata',
      changedBy: null,
      changedAt: null,
    })
    const put = (url: unknown) => call('PUT', '/supplier/onec', staff.accessToken, { url })
    expect((await put('не адрес')).statusCode).toBe(400)
    // A server that does not answer: nothing kept, the cabinet stays where it was.
    const down = await put('https://typo.1c.test/base/odata/standard.odata')
    expect(down.statusCode).toBe(422)
    expect(moved).toEqual([])
    expect((await get()).url).toBe('https://old.1c.test/base/odata/standard.odata')

    const ok = await put(' https://new.1c.test/base/odata/standard.odata/ ')
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({
      url: 'https://new.1c.test/base/odata/standard.odata',
      changedBy: 'Мастер',
    })
    expect(moved).toEqual(['https://new.1c.test/base/odata/standard.odata'])
    expect((await get()).url).toBe('https://new.1c.test/base/odata/standard.odata')
  })
})
