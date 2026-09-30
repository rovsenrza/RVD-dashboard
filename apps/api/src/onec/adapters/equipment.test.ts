// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clients, equipment, item, release } from '../__fixtures__/builders.ts'
import { toEquipment } from './equipment.ts'
import { toProducts } from './product.ts'

const TODAY = new Date('2026-09-30T12:00:00')

const installedOn = (id: string, machine: string, date: string) => [
  release({
    Ref_Key: `${id}-i`,
    Изделие_Key: id,
    Статус: 'ВЭксплуатации',
    Date: date,
    ГаражныйНомер_Key: machine,
  }),
]

describe('toEquipment', () => {
  const build = () => {
    const items = [item({ Ref_Key: 'h1' }), item({ Ref_Key: 'h2' }), item({ Ref_Key: 'h3' })]
    const releases = [
      ...installedOn('h1', 'eq-1', '2026-08-01T00:00:00'), // ok
      ...installedOn('h2', 'eq-1', '2025-09-01T00:00:00'), // overdue
      ...installedOn('h3', 'eq-1', '2026-08-10T00:00:00'),
      release({
        Ref_Key: 'h3-w',
        Number: '9',
        Изделие_Key: 'h3',
        Статус: 'Списан',
        Date: '2026-09-01T00:00:00',
        ГаражныйНомер_Key: 'eq-1',
      }),
    ]
    const equipmentRows = [equipment(), equipment({ Ref_Key: 'eq-2', DeletionMark: true })]
    const products = toProducts(
      { items, releases, catalogNumbers: [], components: [], equipment: equipmentRows, clients },
      { today: TODAY },
    )
    return toEquipment({
      equipment: equipmentRows,
      brands: [{ Ref_Key: 'brand-1', Description: 'FAW' }],
      types: [{ Ref_Key: 'type-1', Description: 'Самосвал' }],
      clients,
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
      branchId: 'branch-1',
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
})
