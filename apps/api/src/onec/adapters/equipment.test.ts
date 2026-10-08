// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { equipment, item, statusRecord } from '../__fixtures__/builders.ts'
import { toEquipment } from './equipment.ts'
import { toProducts } from './product.ts'

const TODAY = new Date('2026-09-30T12:00:00')

/** The register's record of a hose reaching a stage. */
const step = (id: string, status: string, date: string) =>
  statusRecord({ Recorder: `${id}-${status}`, Изделие_Key: id, Статус: status, Period: date })

describe('toEquipment', () => {
  const build = () => {
    const items = ['h1', 'h2', 'h3'].map((id) => item({ Ref_Key: id, Owner_Key: 'eq-1' }))
    const statuses = [
      step('h1', 'ВЭксплуатации', '2026-08-01T00:00:00'), // ok
      step('h2', 'ВЭксплуатации', '2025-09-01T00:00:00'), // overdue
      step('h3', 'ВЭксплуатации', '2026-08-10T00:00:00'),
      step('h3', 'Списан', '2026-09-01T00:00:00'),
    ]
    const equipmentRows = [equipment(), equipment({ Ref_Key: 'eq-2', DeletionMark: true })]
    const products = toProducts(
      {
        items,
        statuses,
        catalogNumbers: [],
        components: [],
        equipment: equipmentRows,
      },
      { today: TODAY },
    )
    return toEquipment({
      equipment: equipmentRows,
      brands: [{ Ref_Key: 'brand-1', Description: 'FAW' }],
      types: [{ Ref_Key: 'type-1', Description: 'Самосвал' }],
      products,
    })
  }

  it('names the machine and skips deleted ones', () => {
    const [eq, ...rest] = build()
    expect(rest).toEqual([])
    expect(eq).toMatchObject({
      id: 'eq-1',
      brand: 'FAW',
      type: 'Самосвал',
      garageNumber: 'р414вв154',
      inventoryNumber: null,
      branchId: 'client-1',
    })
  })

  it('counts the hoses on it without the written-off one, by status', () => {
    const [eq] = build()
    expect(eq.hoseCount).toBe(2)
    expect(eq.statusBreakdown).toEqual({ ok: 1, warn: 0, replace: 1, no_warranty: 0 })
  })

  it('reports the earliest planned replacement', () => {
    expect(build()[0].nextPlannedReplacement).toBe('2026-09-01')
  })

  it('leaves out the «Без привязки» placeholders and names a machine without a garage number', () => {
    const machines = toEquipment({
      equipment: [
        equipment({ Ref_Key: 'stub', Description: 'Без привязки к технике', ГаражныйНомер: '' }),
        equipment({ Ref_Key: 'eq-9', Description: 'Экскаватор Lovol FP215W ', ГаражныйНомер: '' }),
        equipment({
          Ref_Key: 'eq-8',
          Description: 'без привязки Камаз 0321',
          ГаражныйНомер: '0321',
        }),
      ],
      brands: [],
      types: [],
      products: [],
    })
    expect(machines.map((m) => [m.id, m.garageNumber])).toEqual([
      ['eq-9', 'Экскаватор Lovol FP215W'],
      ['eq-8', '0321'],
    ])
  })
})
