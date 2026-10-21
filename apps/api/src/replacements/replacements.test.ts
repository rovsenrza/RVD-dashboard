// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, type Replacement } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { machine, product } from '../test/rows.ts'

const TODAY = '2026-09-30'

describe.skipIf(!hasDb)('the replacement journal from 1С links', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    const k1 = [
      product({
        id: 'old1',
        serialNumber: '11',
        equipmentId: 'e1',
        shippedAt: '2026-03-01',
        manufacturedAt: '2026-02-20',
      }),
      product({
        id: 'new1',
        serialNumber: '12',
        equipmentId: 'e1',
        shippedAt: '2026-09-20',
        manufacturedAt: '2026-09-15',
        replacedProductId: 'old1',
      }),
      // Installed on no machine 1С knows; installation dates the swap over shipment.
      product({ id: 'old2', serialNumber: '21', shippedAt: '2025-08-01' }),
      product({
        id: 'new2',
        serialNumber: '22',
        shippedAt: '2026-07-01',
        installedAt: '2026-08-10',
        replacedProductId: 'old2',
      }),
      // Still being made: an order in progress, not a swap yet.
      product({ id: 'old3', serialNumber: '31', equipmentId: 'e1', shippedAt: '2026-01-01' }),
      product({
        id: 'new3',
        serialNumber: '32',
        lifecycle: 'manufacturing',
        replacedProductId: 'old3',
      }),
      // Names another client's hose: never shown, so no foreign serial number leaks.
      product({
        id: 'new4',
        serialNumber: '42',
        shippedAt: '2026-09-25',
        replacedProductId: 'foreign',
      }),
    ]
    const k2 = [
      product({ id: 'foreign', serialNumber: '91', shippedAt: '2026-01-01' }),
      product({
        id: 'theirs',
        serialNumber: '92',
        shippedAt: '2026-09-28',
        replacedProductId: 'foreign',
      }),
    ]
    await storeCache(
      db,
      {
        products: [
          ...k1.map((p) => ({ product: p, clientId: 'k1' })),
          ...k2.map((p) => ({ product: p, clientId: 'k2' })),
        ],
        equipment: [{ equipment: machine('e1', { garageNumber: 'НТ08' }), clientId: 'k1' }],
      },
      1,
    )
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: TODAY, rules: DEFAULT_RULES }),
      requests: { clientKey: 'k1' },
    })
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  const get = async (url: string) => (await app.inject(url)).json()
  const ids = (list: Replacement[]) => list.map((r) => [r.oldProductId, r.newProductId])

  it('lists the client’s swaps newest first, without the ones 1С keeps no record of', async () => {
    const list = (await get('/replacements')) as Replacement[]
    expect(ids(list)).toEqual([
      ['old1', 'new1'],
      ['old2', 'new2'],
    ])
    expect(list[0]).toEqual({
      id: 'new1',
      oldProductId: 'old1',
      oldSerialNumber: '11',
      newProductId: 'new1',
      newSerialNumber: '12',
      equipmentId: 'e1',
      garageNumber: 'НТ08',
      date: '2026-09-20',
      reason: null,
      operatingHours: null,
      usageUnit: 'hours',
      performerId: null,
      performedBy: null,
      comment: null,
      attachments: [],
    })
    expect(list[1]).toMatchObject({ date: '2026-08-10', equipmentId: null, garageNumber: null })
  })

  it('shows a swap on both hoses’ cards and on the machine’s', async () => {
    expect(ids(await get('/products/old1/replacements'))).toEqual([['old1', 'new1']])
    expect(ids(await get('/products/new1/replacements'))).toEqual([['old1', 'new1']])
    expect(await get('/products/old3/replacements')).toEqual([])
    expect(ids(await get('/equipment/e1/replacements'))).toEqual([['old1', 'new1']])
    // Another client's hose: nothing, as if it did not exist.
    expect(await get('/products/theirs/replacements')).toEqual([])
  })

  it('counts the dashboard’s swaps by the journal’s rule', async () => {
    const summary = await get('/dashboard/summary')
    // Since 31.08: new1; the 30 days before: new2.
    expect(summary.replacementsInPeriod).toBe(1)
    expect(summary.deltas.replacements).toBe(0)
    // Hoses made per month: old1 in February, new1 (made to replace it) in September.
    const months = summary.productsByMonth as { month: string; made: number; replaced: number }[]
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ month: '2025-10', made: 0, replaced: 0 })
    expect(months.find((m) => m.month === '2026-02')).toEqual({
      month: '2026-02',
      made: 1,
      replaced: 0,
    })
    expect(months.at(-1)).toEqual({ month: '2026-09', made: 0, replaced: 1 })
  })

  it('counts them over the period the dashboard picks', async () => {
    // Since 02.07: new1 and new2; the 90 days before: none.
    const quarter = await get('/dashboard/summary?days=90')
    expect(quarter).toMatchObject({ periodDays: 90, replacementsInPeriod: 2 })
    expect(quarter.deltas.replacements).toBe(2)
    // Not one of the dashboard's periods: the month.
    expect(await get('/dashboard/summary?days=7')).toMatchObject({
      periodDays: 30,
      replacementsInPeriod: 1,
    })
  })

  it('shows the reason and running hours the client gave in the replacement request', async () => {
    const asked = await app.inject({
      method: 'POST',
      url: '/requests',
      payload: {
        branchId: '',
        kind: 'replace',
        comment: null,
        positions: [
          {
            productId: 'old1',
            catalogNumberId: null,
            catalogNumber: null,
            equipmentId: null,
            quantity: 1,
            reason: 'Износ',
            operatingHours: 2241,
            usageUnit: 'hours',
          },
        ],
      },
    })
    expect(asked.statusCode).toBe(201)
    const [swap] = (await get('/products/old1/replacements')) as Replacement[]
    expect(swap).toMatchObject({ reason: 'Износ', operatingHours: 2241, usageUnit: 'hours' })
    // A swap nobody asked about keeps 1С's silence.
    const other = (await get('/replacements')) as Replacement[]
    expect(other.find((r) => r.oldProductId === 'old2')).toMatchObject({ reason: null })
  })

  it('keeps who swapped the hose: one of the company’s active staff, picked in the cabinet', async () => {
    await db.query(
      `insert into companies (id, name, onec_client_key) values ('demo', 'Демо', 'k-demo'),
         ('other', 'Чужие', 'k-other')`,
    )
    await db.query(
      `insert into users (id, company_id, name, email, password_hash, role, active) values
         ('m1', 'demo', 'Иванов И.', 'm1@x.ru', '-', 'mechanic', true),
         ('m2', 'demo', 'Уволен У.', 'm2@x.ru', '-', 'mechanic', false),
         ('x1', 'other', 'Чужой Ч.', 'x1@x.ru', '-', 'mechanic', true)`,
    )
    expect(await get('/staff')).toEqual([{ id: 'm1', name: 'Иванов И.' }])

    const set = (id: string, performerId: string | null) =>
      app.inject({ method: 'PATCH', url: `/replacements/${id}`, payload: { performerId } })
    const done = await set('new1', 'm1')
    expect(done.statusCode).toBe(200)
    expect(done.json()).toMatchObject({ id: 'new1', performerId: 'm1', performedBy: 'Иванов И.' })
    expect(((await get('/products/old1/replacements')) as Replacement[])[0]).toMatchObject({
      performedBy: 'Иванов И.',
    })
    // Someone switched off, of another company, or a swap the reader does not see.
    expect((await set('new1', 'm2')).statusCode).toBe(400)
    expect((await set('new1', 'x1')).statusCode).toBe(400)
    expect((await set('theirs', 'm1')).statusCode).toBe(404)
    // Cleared again.
    expect((await set('new1', null)).json()).toMatchObject({ performerId: null, performedBy: null })
  })
})
