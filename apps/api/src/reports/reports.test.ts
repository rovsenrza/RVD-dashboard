// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, type ModelStats, type Report } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import { addUser } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { machine, product } from '../test/rows.ts'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'
const TODAY = '2026-10-03'

describe.skipIf(!hasDb)('reports and the model comparison on the server', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let manager: string
  let mechanic: string

  const get = (url: string, token: string) =>
    app.inject({ url, headers: { authorization: `Bearer ${token}` } })
  const report = async (url: string) => (await get(url, manager)).json() as Report

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    const company = { company: 'ООО Ромашка', clientKey: 'k1' }
    await addUser(db, {
      ...company,
      name: 'Руководитель',
      email: 'boss@r.ru',
      password: 'руководитель-1',
      role: 'manager',
    })
    await addUser(db, {
      ...company,
      name: 'Механик',
      email: 'mech@r.ru',
      password: 'механик-пароль-1',
      role: 'mechanic',
    })
    const hose = (id: string, serialNumber: string, shippedAt: string, over = {}) =>
      product({ id, serialNumber, shippedAt, lifecycle: 'shipped', equipmentId: 'e1', ...over })
    await storeCache(
      db,
      {
        products: [
          // Overdue since 01.09.2026.
          { product: hose('h1', '11', '2025-09-01'), clientId: 'k1' },
          // Planned 01.12.2026, warranty until 01.10.2027.
          { product: hose('h2', '12', '2025-12-01', { warrantyDays: 669 }), clientId: 'k1' },
          // Replaces h1, shipped two days ago.
          {
            product: hose('h3', '13', '2026-10-01', { replacedProductId: 'h1' }),
            clientId: 'k1',
          },
          { product: hose('x1', '91', '2025-09-01'), clientId: 'k2' },
        ],
        equipment: [
          {
            equipment: machine('e1', { garageNumber: 'НТ08', brand: 'БелАЗ', type: 'Самосвал' }),
            clientId: 'k1',
          },
        ],
      },
      1,
    )
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: TODAY, rules: DEFAULT_RULES }),
      auth: { secret: SECRET },
    })
    const signIn = async (email: string, password: string) =>
      (
        await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })
      ).json().accessToken as string
    manager = await signIn('boss@r.ru', 'руководитель-1')
    mechanic = await signIn('mech@r.ru', 'механик-пароль-1')
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('keeps reports and the comparison to the manager and the administrator', async () => {
    expect((await get('/reports/registry', mechanic)).statusCode).toBe(403)
    expect((await get('/analytics/models', mechanic)).statusCode).toBe(403)
    expect((await get('/reports/nope', manager)).statusCode).toBe(404)
  })

  it('builds the registry of the company’s own hoses, counted from shipment', async () => {
    const registry = await report('/reports/registry')
    expect(registry.rows.map((r) => [r.serial, r.machine, r.installed, r.status])).toEqual([
      ['11', 'НТ08', '2025-09-01', 'replace'],
      ['12', 'НТ08', '2025-12-01', 'ok'],
      ['13', 'НТ08', '2026-10-01', 'ok'],
    ])
    expect(registry.rows[0].left).toBe(-32)
  })

  it('lists what is due and what the next quarter needs', async () => {
    expect((await report('/reports/due')).rows.map((r) => [r.serial, r.overdue])).toEqual([
      ['11', 32],
    ])
    const plan = await report('/reports/plan?from=2026-10-03&to=2026-12-31')
    expect(plan.period).toEqual({ from: '2026-10-03', to: '2026-12-31' })
    expect(plan.rows.map((r) => [r.planned, r.serial])).toEqual([
      ['2026-09-01', '11'],
      ['2026-12-01', '12'],
    ])
  })

  it('counts swaps per machine and names the one branch after the company', async () => {
    const swaps = await report('/reports/replacements?from=2026-09-03&to=2026-10-03')
    expect(swaps.rows.map((r) => [r.date, r.old, r.new, r.reason])).toEqual([
      ['2026-10-01', '11', '13', null],
    ])
    const branches = await report('/reports/branches?from=2026-09-03&to=2026-10-03')
    expect(branches.rows).toEqual([
      expect.objectContaining({ branch: 'ООО Ромашка', machines: 1, hoses: 3, swaps: 1 }),
    ])
    expect(branches.totals).toMatchObject({ branch: 'Итого', hoses: 3 })
  })

  it('compares machine brands without inventing a failure share 1С does not keep', async () => {
    const [belaz] = (await get('/analytics/models', manager)).json() as ModelStats[]
    expect(belaz).toMatchObject({
      model: 'БелАЗ',
      machines: 1,
      hoses: 3,
      replacements12m: 1,
      failureShare: null,
      avgServiceDays: 395,
    })
  })
})
