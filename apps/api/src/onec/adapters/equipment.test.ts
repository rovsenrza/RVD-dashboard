// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clients, equipment, item, release, statusRecord } from '../__fixtures__/builders.ts'
import { toEquipment } from './equipment.ts'
import { toProducts } from './product.ts'

const TODAY = new Date('2026-09-30T12:00:00')

/** The register's record of a hose going onto a machine, and the «Выпуск» that names the machine. */
const onMachine = (id: string, status: string, machine: string, date: string) => ({
  statuses: [
    statusRecord({ Recorder: `${id}-${status}`, Изделие_Key: id, Статус: status, Period: date }),
  ],
  releases: [release({ Ref_Key: `${id}-${status}`, ГаражныйНомер_Key: machine })],
})

describe('toEquipment', () => {
  const build = () => {
    const items = [item({ Ref_Key: 'h1' }), item({ Ref_Key: 'h2' }), item({ Ref_Key: 'h3' })]
    const steps = [
      onMachine('h1', 'ВЭксплуатации', 'eq-1', '2026-08-01T00:00:00'), // ok
      onMachine('h2', 'ВЭксплуатации', 'eq-1', '2025-09-01T00:00:00'), // overdue
      onMachine('h3', 'ВЭксплуатации', 'eq-1', '2026-08-10T00:00:00'),
      onMachine('h3', 'Списан', 'eq-1', '2026-09-01T00:00:00'),
    ]
    const statuses = steps.flatMap((s) => s.statuses)
    const releases = steps.flatMap((s) => s.releases)
    const equipmentRows = [equipment(), equipment({ Ref_Key: 'eq-2', DeletionMark: true })]
    const products = toProducts(
      {
        items,
        statuses,
        releases,
        catalogNumbers: [],
        components: [],
        equipment: equipmentRows,
        clients,
      },
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
