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
      product({ id: 'old1', serialNumber: '11', equipmentId: 'e1', shippedAt: '2026-03-01' }),
      product({
        id: 'new1',
        serialNumber: '12',
        equipmentId: 'e1',
        shippedAt: '2026-09-20',
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
    expect(summary.replacementsByMonth).toHaveLength(12)
    expect(summary.replacementsByMonth[0]).toEqual({ month: '2025-10', count: 0 })
    expect(summary.replacementsByMonth.slice(-2)).toEqual([
      { month: '2026-08', count: 1 },
      { month: '2026-09', count: 1 },
    ])
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
})
