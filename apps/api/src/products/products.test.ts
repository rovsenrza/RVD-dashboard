// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, statusOf, type Product, type StatusRules } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { machine, product } from '../test/rows.ts'

const TODAY = '2026-09-30'

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
    product: product({
      id: 'p2',
      serialNumber: '10',
      installedAt: '2025-09-01',
      type: '4SH ду25',
      installPlace: 'Ковш',
    }),
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
    await storeCache(
      db,
      {
        products: rows,
        history: new Map([
          [
            'p1',
            [
              {
                id: 'p1:0',
                productId: 'p1',
                at: '2026-08-18T10:00:00',
                lifecycle: 'shipped',
                status: 'Отгружен',
                document: { kind: 'release', number: '124' },
                author: null,
              },
            ],
          ],
        ]),
        equipment: [{ equipment: machine('e1', { garageNumber: 'р414вв154' }), clientId: 'k1' }],
      },
      12,
    )
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

  it('pages with the total of all matches, even past the last page', async () => {
    const body = await get('/products?limit=2&page=2')
    expect(body).toMatchObject({ total: 4, page: 2, limit: 2 })
    expect(body.items).toHaveLength(2)
    expect(await get('/products?limit=2&page=9')).toMatchObject({ items: [], total: 4 })
  })

  it('counts both tabs under the same filters and search', async () => {
    expect(await get('/products?archive=1')).toMatchObject({
      total: 1,
      counts: { active: 3, archive: 1 },
    })
    expect((await get('/products?archive=1&q=4sh')).counts).toEqual({ active: 1, archive: 0 })
  })

  it('sorts by every registry column, empty values last either way', async () => {
    expect(ids(await get('/products?sort=installPlace')).slice(0, 1)).toEqual(['p2'])
    expect(ids(await get('/products?sort=installPlace&dir=desc')).slice(0, 1)).toEqual(['p2'])
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

  it('filters by customer, machine, catalogue number, installation and branch — one of the clients', async () => {
    expect(ids(await get('/products?client=k2'))).toEqual(['p4', 'p3'])
    expect(ids(await get('/products?equipment=e1'))).toEqual(['p1'])
    expect(ids(await get('/products?catalog=c1'))).toEqual(['p1'])
    expect(ids(await get('/products?installed=0'))).toEqual(['p4'])
    expect(ids(await get('/products?branch=k2'))).toEqual(['p4', 'p3'])
  })

  it('searches the numbers, the name, the machine and the place, and treats wildcards literally', async () => {
    expect(ids(await get('/products?q=02753'))).toEqual(['p1'])
    expect(ids(await get('/products?q=4sh'))).toEqual(['p2'])
    expect(ids(await get('/products?q=Р414'))).toEqual(['p1'])
    expect(ids(await get('/products?q=ковш'))).toEqual(['p2'])
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

  it('serves the register history of a hose, an empty one, and 404 for an unknown hose', async () => {
    expect(await get('/products/p1/history')).toMatchObject([
      { status: 'Отгружен', document: { kind: 'release', number: '124' } },
    ])
    expect(await get('/products/p2/history')).toEqual([])
    expect((await app.inject('/products/nope/history')).statusCode).toBe(404)
  })

  it('records the sync', async () => {
    const state = await get('/sync/status')
    expect(state).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'products', rows: 4 }),
        expect.objectContaining({ entity: 'equipment', rows: 1 }),
      ]),
    )
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
    await storeCache(db, { products: synthetic }, 1)
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
