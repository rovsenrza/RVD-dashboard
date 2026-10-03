// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, statusOf, type Product, type StatusRules } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import { storeProducts } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'

const TODAY = '2026-09-30'

const product = (over: Partial<Product> & { id: string }): Product => ({
  serialNumber: '1',
  clientNumber: null,
  catalogNumberId: null,
  catalogNumber: null,
  nomenclatureNumber: null,
  type: '2SC ду10',
  manufacturer: '',
  specs: '',
  diameter: 10,
  braidCount: 2,
  composition: [],
  manufacturedAt: null,
  shippedAt: null,
  installedAt: null,
  warrantyDays: 180,
  serviceLifeDays: 365,
  status: 'ok',
  lifecycle: 'in_operation',
  replacedProductId: null,
  equipmentId: null,
  installPlace: null,
  branchId: 'b1',
  ...over,
})

const rows = [
  {
    product: product({
      id: 'p1',
      serialNumber: '9',
      installedAt: '2026-08-01',
      catalogNumber: '02753-00613',
      catalogNumberId: 'c1',
      equipmentId: 'e1',
    }),
    clientId: 'k1',
  },
  {
    product: product({ id: 'p2', serialNumber: '10', installedAt: '2025-09-01', type: '4SH ду25' }),
    clientId: 'k1',
  },
  {
    product: product({
      id: 'p3',
      serialNumber: '100',
      lifecycle: 'written_off',
      installedAt: '2025-01-01',
    }),
    clientId: 'k2',
  },
  {
    product: product({ id: 'p4', serialNumber: '2', lifecycle: 'in_stock', branchId: 'b2' }),
    clientId: 'k2',
  },
]

describe.skipIf(!hasDb)('products in the cache', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    await storeProducts(db, rows, 12)
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: TODAY, rules: DEFAULT_RULES }),
    })
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  const get = async (url: string) => (await app.inject(url)).json()
  const ids = (body: { items: Product[] }) => body.items.map((p) => p.id)

  it('pages with the total of all matches', async () => {
    const body = await get('/products?limit=2&page=2')
    expect(body).toMatchObject({ total: 4, page: 2, limit: 2 })
    expect(body.items).toHaveLength(2)
  })

  it('sorts serial numbers as numbers, not as text', async () => {
    expect(ids(await get('/products?sort=serialNumber'))).toEqual(['p4', 'p1', 'p2', 'p3'])
    expect(ids(await get('/products?sort=serialNumber&dir=desc'))).toEqual(['p3', 'p2', 'p1', 'p4'])
  })

  it('derives the status for the day and filters by it', async () => {
    const all = await get('/products')
    const byId = Object.fromEntries(all.items.map((p: Product) => [p.id, p.status]))
    expect(byId).toMatchObject({ p1: 'ok', p2: 'replace', p4: 'no_warranty' })
    expect(ids(await get('/products?status=replace'))).toEqual(['p2', 'p3'])
  })

  it('splits the registry from the archive', async () => {
    expect(ids(await get('/products?archive=1'))).toEqual(['p3'])
    expect(await get('/products?archive=0')).toMatchObject({ total: 3 })
  })

  it('filters by customer, machine, catalogue number, installation and branch', async () => {
    expect(ids(await get('/products?client=k2'))).toEqual(['p4', 'p3'])
    expect(ids(await get('/products?equipment=e1'))).toEqual(['p1'])
    expect(ids(await get('/products?catalog=c1'))).toEqual(['p1'])
    expect(ids(await get('/products?installed=0'))).toEqual(['p4'])
    expect(ids(await get('/products?branch=b2'))).toEqual(['p4'])
  })

  it('searches the numbers and the name, and treats wildcards literally', async () => {
    expect(ids(await get('/products?q=02753'))).toEqual(['p1'])
    expect(ids(await get('/products?q=4sh'))).toEqual(['p2'])
    expect(await get('/products?q=%25')).toMatchObject({ total: 0 })
  })

  it('returns one product or a 404, and rejects a bad query', async () => {
    expect((await get('/products/p1')).serialNumber).toBe('9')
    expect((await app.inject('/products/nope')).statusCode).toBe(404)
    expect((await app.inject('/products?limit=0')).statusCode).toBe(400)
  })

  it('lays the service life out on a timeline, or says null without dates', async () => {
    const life = await get('/products/p1/lifetime')
    expect(life).toMatchObject({
      basis: 'installed',
      startedAt: '2026-08-01',
      plannedAt: '2027-08-01',
    })
    expect(life.phases.at(-1)).toEqual({ status: 'replace', from: '2027-08-01', to: null })
    expect(await get('/products/p4/lifetime')).toBeNull()
    expect((await app.inject('/products/nope/lifetime')).statusCode).toBe(404)
  })

  it('records the sync', async () => {
    const state = await get('/sync/status')
    expect(state).toMatchObject([{ entity: 'products', rows: 4 }])
  })

  it('answers exactly as the TypeScript rule for every combination', async () => {
    const days = [0, 1, 59, 60, 61, 179, 180, 181, 300, 330, 334, 335, 336, 364, 365, 366, 500]
    const rulesList: StatusRules[] = [
      DEFAULT_RULES,
      { warnRule: 'days', warnPercent: 20, warnDays: 60 },
      { warnRule: 'percent', warnPercent: 20, warnDays: 30 },
      { warnRule: 'percent', warnPercent: 33, warnDays: 60 },
    ]
    const facts = []
    for (const life of [0, 30, 365, 730]) {
      for (const warranty of [0, 180]) {
        for (const age of days) {
          const start = new Date(Date.parse(TODAY) - age * 86_400_000).toISOString().slice(0, 10)
          for (const basis of ['installedAt', 'shippedAt'] as const) {
            facts.push({ life, warranty, start, basis })
          }
        }
      }
    }
    const synthetic = facts.map((f, i) => ({
      product: product({
        id: `s${i}`,
        serviceLifeDays: f.life,
        warrantyDays: f.warranty,
        installedAt: f.basis === 'installedAt' ? f.start : null,
        shippedAt: f.basis === 'shippedAt' ? f.start : null,
      }),
      clientId: 'k',
    }))
    await storeProducts(db, synthetic, 1)
    for (const rules of rulesList) {
      const check = buildApp({ logLevel: 'silent', db, clock: () => ({ today: TODAY, rules }) })
      const body = await (await check.inject('/products?limit=5000&sort=serialNumber')).json()
      const sqlStatus = new Map(body.items.map((p: Product) => [p.id, p.status]))
      let mismatches = 0
      for (const { product: p } of synthetic) {
        const expected =
          p.serviceLifeDays > 0 ? statusOf(p, rules, new Date(`${TODAY}T12:00:00`)) : 'no_warranty'
        if (sqlStatus.get(p.id) !== expected) mismatches++
      }
      await check.close()
      expect(mismatches).toBe(0)
    }
  })
})
