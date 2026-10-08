// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ZERO_GUID } from '../raw.ts'
import {
  catalogNumber,
  components,
  equipment,
  item,
  statusRecord,
} from '../__fixtures__/builders.ts'
import { toProducts, type ProductSources } from './product.ts'

const TODAY = new Date('2026-09-30T12:00:00')

const sources = (over: Partial<ProductSources> = {}): ProductSources => ({
  items: [item()],
  statuses: [],
  catalogNumbers: [],
  components,
  equipment: [equipment()],
  ...over,
})

const one = (over: Partial<ProductSources> = {}) => toProducts(sources(over), { today: TODAY })[0]

describe('identity', () => {
  it('shows the 1С code without its padding zeros', () => {
    expect(one().serialNumber).toBe('3844')
    expect(one({ items: [item({ Code: '00000000000000000099' })] }).serialNumber).toBe('99')
  })

  it('cleans the description of no-break spaces', () => {
    expect(one().type).toBe('2SC ду10 рукав Rock Arctic L 1 050')
  })

  it('drops items marked for deletion and keeps the rest', () => {
    const rows = toProducts(
      sources({ items: [item(), item({ Ref_Key: 'gone', DeletionMark: true })] }),
    )
    expect(rows.map((r) => r.id)).toEqual(['item-1'])
  })

  it('reads the blank braid count as zero and the padded one as a number', () => {
    expect(one().braidCount).toBe(2)
    expect(one({ items: [item({ КоличествоОплетокНавивок: '   ' })] }).braidCount).toBe(0)
  })
})

describe('dates and lifecycle come from the statuses register', () => {
  const chain = [
    statusRecord({ Recorder: 'a', Period: '2026-01-10T09:00:00', Статус: 'Изготавливается' }),
    statusRecord({ Recorder: 'b', Period: '2026-01-20T09:00:00', Статус: 'Отгружен' }),
    statusRecord({ Recorder: 'c', Period: '2026-02-01T15:30:00', Статус: 'ВЭксплуатации' }),
  ]
  const onEq1 = [item({ Owner_Key: 'eq-1' })]

  it('takes shipment, installation and stage from the register, the machine from the item', () => {
    const p = one({ items: onEq1, statuses: chain })
    expect(p).toMatchObject({
      manufacturedAt: '2026-01-10',
      shippedAt: '2026-01-20',
      installedAt: '2026-02-01',
      equipmentId: 'eq-1',
      lifecycle: 'in_operation',
    })
  })

  it('believes the register when a document recorded a later shipment than its header says', () => {
    // As in the working base: «Выпуск» of 18.08, «НаСкладе» in its header, recorded «Отгружен» on 27.08.
    const p = one({
      items: onEq1,
      statuses: [
        statusRecord({ Recorder: 'd', Period: '2026-08-18T10:00:00', Статус: 'НаСкладе' }),
        statusRecord({
          Recorder: 'd',
          Period: '2026-08-27T09:00:00',
          LineNumber: '2',
          Статус: 'Отгружен',
        }),
      ],
    })
    expect(p).toMatchObject({ lifecycle: 'shipped', shippedAt: '2026-08-27', equipmentId: 'eq-1' })
  })

  it('takes a status an order set', () => {
    const p = one({
      items: onEq1,
      statuses: [
        ...chain.slice(0, 2),
        statusRecord({
          Recorder: 'order-1',
          Recorder_Type: 'StandardODATA.Document_ЗаказыКлиента',
          Period: '2026-03-01T00:00:00',
          Статус: 'Отгружен',
        }),
      ],
    })
    expect(p).toMatchObject({ lifecycle: 'shipped', shippedAt: '2026-03-01', equipmentId: 'eq-1' })
  })

  it('ignores records that are no longer active', () => {
    const p = one({
      statuses: [...chain.slice(0, 2), { ...chain[2], Active: false }],
    })
    expect(p).toMatchObject({ installedAt: null, lifecycle: 'shipped' })
  })

  it('orders the records of one moment by their line in the document', () => {
    const same = '2026-05-05T10:00:00'
    const p = one({
      statuses: [
        statusRecord({ Recorder: 'x', Period: same, LineNumber: '2', Статус: 'Отгружен' }),
        statusRecord({ Recorder: 'x', Period: same, LineNumber: '1', Статус: 'НаСкладе' }),
      ],
    })
    expect(p.lifecycle).toBe('shipped')
  })

  it('puts an item on a machine only from shipment on, however early it names one', () => {
    const inStock = statusRecord({ Статус: 'НаСкладе' })
    expect(one({ items: onEq1, statuses: [inStock] }).equipmentId).toBeNull()
    expect(one({ items: onEq1, statuses: [{ ...inStock, Статус: 'Отгружен' }] }).equipmentId).toBe(
      'eq-1',
    )
  })

  it('puts no hose on the «Без привязки к технике» placeholder', () => {
    const p = one({
      items: [item({ Owner_Key: 'stub' })],
      statuses: [statusRecord({ Статус: 'Отгружен' })],
      equipment: [
        equipment(),
        equipment({ Ref_Key: 'stub', Description: 'Без привязки к технике' }),
      ],
    })
    expect(p).toMatchObject({ lifecycle: 'shipped', equipmentId: null })
  })

  it('has no dates for an item 1С never released', () => {
    expect(one()).toMatchObject({ manufacturedAt: null, shippedAt: null, installedAt: null })
  })

  it('keeps the stage and the machine when 1С records a status the cabinet does not know yet', () => {
    // The 1С repair package will write a repair line into the status history of a hose.
    const p = one({
      items: onEq1,
      statuses: [
        statusRecord({ Recorder: 'a', Period: '2026-06-01T09:00:00', Статус: 'Отгружен' }),
        statusRecord({ Recorder: 'r', Period: '2026-09-10T09:00:00', Статус: 'Ремонт' }),
      ],
    })
    expect(p).toMatchObject({ lifecycle: 'shipped', shippedAt: '2026-06-01', equipmentId: 'eq-1' })
  })

  it('maps the empty status to manufacturing, and a machine missing from the catalogue to none', () => {
    expect(one({ statuses: [statusRecord({ Статус: '' })] }).lifecycle).toBe('manufacturing')
    const p = one({
      items: [item({ Owner_Key: 'not-in-catalogue' })],
      statuses: [statusRecord({ Статус: 'Отгружен' })],
    })
    expect(p).toMatchObject({ lifecycle: 'shipped', equipmentId: null })
  })
})

describe('catalogue number', () => {
  const cat = [catalogNumber()]

  it('fills what the item leaves empty', () => {
    const p = one({
      items: [
        item({
          Description: '',
          КаталожныйНомер_Key: 'cat-1',
          СрокПолезногоИспользования: '0',
          Диаметр: 0,
          КоличествоОплетокНавивок: '   ',
        }),
      ],
      catalogNumbers: cat,
    })
    expect(p).toMatchObject({
      type: '02753-00613',
      catalogNumber: '02753-00613',
      catalogNumberId: 'cat-1',
      serviceLifeDays: 730,
      diameter: 20,
      braidCount: 4,
    })
    expect(p.composition.map((l) => [l.name, l.quantity])).toEqual([
      ['4SH ду25 рукав', 1.35],
      ['16x1.5 фитинг', 2],
    ])
  })

  it('prefers the composition recorded on the item', () => {
    const p = one({
      items: [
        item({
          КаталожныйНомер_Key: 'cat-1',
          Комплектующие: [
            { LineNumber: '1', Комплектующие_Key: 'comp-fitting', ЗначениеПоказателя: 9 },
          ],
        }),
      ],
      catalogNumbers: cat,
    })
    expect(p.composition).toEqual([
      { componentId: 'comp-fitting', name: '16x1.5 фитинг', quantity: 9 },
    ])
  })

  it('leaves the catalogue fields empty when the item has no catalogue number', () => {
    expect(one()).toMatchObject({ catalogNumber: null, catalogNumberId: null })
  })
})

describe('health and ownership', () => {
  it('computes the status for the given day from the installation date', () => {
    const installed = statusRecord({ Статус: 'ВЭксплуатации', Period: '2026-01-01T00:00:00' })
    expect(one({ statuses: [installed] }).status).toBe('no_warranty') // past 180 days of warranty
    expect(one({ statuses: [{ ...installed, Period: '2026-08-01T00:00:00' }] }).status).toBe('ok')
    expect(one({ statuses: [{ ...installed, Period: '2025-09-01T00:00:00' }] }).status).toBe(
      'replace',
    )
  })

  it('counts from shipment when there is no installation, and gives up without either', () => {
    const shipped = statusRecord({ Статус: 'Отгружен', Period: '2026-08-15T00:00:00' })
    expect(one({ statuses: [shipped] }).status).toBe('ok')
    expect(one().status).toBe('no_warranty')
  })

  it('links the replaced item and the branch — the customer itself', () => {
    const p = one({ items: [item({ ЗаменяемоеИзделие_Key: 'old-1' })] })
    expect(p).toMatchObject({ replacedProductId: 'old-1', branchId: 'client-1' })
    expect(
      one({ items: [item({ ЗаменяемоеИзделие_Key: ZERO_GUID })] }).replacedProductId,
    ).toBeNull()
  })

  it('does not call an item overdue when 1С gives it no service life', () => {
    const shipped = statusRecord({ Статус: 'Отгружен', Period: '2026-08-15T00:00:00' })
    const p = one({ items: [item({ СрокПолезногоИспользования: '0' })], statuses: [shipped] })
    expect(p).toMatchObject({ serviceLifeDays: 0, status: 'no_warranty' })
  })

  it('reads no warranty as zero days', () => {
    expect(one({ items: [item({ СрокГарантии: '0' })] }).warrantyDays).toBe(0)
  })
})
