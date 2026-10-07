// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, type Equipment } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { product } from '../test/rows.ts'

const TODAY = '2026-09-30'

const machine = (id: string, garageNumber: string): Equipment => ({
  id,
  branchId: 'b1',
  type: 'Самосвал',
  brand: 'БелАЗ',
  model: '',
  garageNumber,
  factoryNumber: null,
  inventoryNumber: null,
  department: null,
  // Whatever the sync stored here is recounted at read time.
  hoseCount: 99,
  lastRepairDate: null,
  nextPlannedReplacement: null,
  statusBreakdown: { ok: 9, warn: 9, replace: 9, no_warranty: 9 },
})

describe.skipIf(!hasDb)('machines and the dashboard from the cache', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    const hoses = [
      product({ id: 'h1', serialNumber: '11', equipmentId: 'e1', shippedAt: '2026-09-01' }), // ok
      product({ id: 'h2', serialNumber: '12', equipmentId: 'e1', shippedAt: '2025-09-01' }), // overdue
      product({
        id: 'h3',
        serialNumber: '13',
        equipmentId: 'e1',
        shippedAt: '2026-09-01',
        lifecycle: 'written_off',
      }),
      product({ id: 'h4', serialNumber: '14', shippedAt: '2026-09-20', lifecycle: 'shipped' }),
    ]
    await storeCache(
      db,
      {
        products: hoses.map((p) => ({ product: p, clientId: 'k1' })),
        equipment: [
          { equipment: machine('e1', 'НТ08'), clientId: 'k1' },
          { equipment: machine('e2', 'ЕХ20'), clientId: 'k1' },
        ],
      },
      1,
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

  it('counts the hoses on each machine for today, without written-off ones', async () => {
    const machines = (await get('/equipment')) as Equipment[]
    expect(machines.map((m) => m.garageNumber)).toEqual(['ЕХ20', 'НТ08'])
    expect(machines[1]).toMatchObject({
      hoseCount: 2,
      statusBreakdown: { ok: 1, warn: 0, replace: 1, no_warranty: 0 },
      nextPlannedReplacement: '2026-09-01',
    })
    expect(machines[0]).toMatchObject({
      hoseCount: 0,
      statusBreakdown: { ok: 0, warn: 0, replace: 0, no_warranty: 0 },
      nextPlannedReplacement: null,
    })
  })

  it('serves one machine, its hoses now and no replacements yet', async () => {
    expect(await get('/equipment/e1')).toMatchObject({ id: 'e1', hoseCount: 2 })
    expect((await app.inject('/equipment/nope')).statusCode).toBe(404)
    const hoses = await get('/equipment/e1/products')
    expect(hoses.map((h: { id: string; status: string }) => [h.id, h.status])).toEqual([
      ['h1', 'ok'],
      ['h2', 'replace'],
    ])
    expect(await get('/equipment/e1/replacements')).toEqual([])
  })

  it('sums the dashboard by the same rule, with the change over 30 days', async () => {
    expect(await get('/dashboard/summary')).toEqual({
      shippedTotal: 3,
      inOperation: 0,
      onWarranty: 2,
      expiringSoon: 0,
      needsReplacement: 1,
      periodDays: 30,
      replacementsInPeriod: 0,
      // Shipped since 31.08: h1, h4. A month ago only h2 was in service, and it was «Внимание».
      deltas: { shippedTotal: 2, replacements: 0, onWarranty: 2, needsReplacement: 1 },
      statusBreakdown: { ok: 2, warn: 0, replace: 1, no_warranty: 0 },
      // The last 12 months, each one present even without a swap.
      replacementsByMonth: Array.from({ length: 12 }, (_, i) => ({
        month: i < 3 ? `2025-${10 + i}` : `2026-0${i - 2}`,
        count: 0,
      })),
      upcoming: [{ productId: 'h1', serialNumber: '11', equipment: 'НТ08', dueDate: '2027-09-01' }],
    })
  })
})
