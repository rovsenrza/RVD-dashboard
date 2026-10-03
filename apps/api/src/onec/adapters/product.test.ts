// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ZERO_GUID } from '../raw.ts'
import {
  catalogNumber,
  clients,
  components,
  equipment,
  item,
  release,
} from '../__fixtures__/builders.ts'
import { toProducts, type ProductSources } from './product.ts'

const TODAY = new Date('2026-09-30T12:00:00')

const sources = (over: Partial<ProductSources> = {}): ProductSources => ({
  items: [item()],
  releases: [],
  catalogNumbers: [],
  components,
  equipment: [equipment()],
  clients,
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

describe('dates and lifecycle come from the release documents', () => {
  const chain = [
    release({ Ref_Key: 'a', Number: '1', Date: '2026-01-10T09:00:00', Статус: 'Изготавливается' }),
    release({ Ref_Key: 'b', Number: '2', Date: '2026-01-20T09:00:00', Статус: 'Отгружен' }),
    release({
      Ref_Key: 'c',
      Number: '3',
      Date: '2026-02-01T15:30:00',
      Статус: 'ВЭксплуатации',
      ГаражныйНомер_Key: 'eq-1',
    }),
  ]

  it('takes shipment, installation, machine and stage from the documents', () => {
    const p = one({ releases: chain })
    expect(p).toMatchObject({
      manufacturedAt: '2026-01-10',
      shippedAt: '2026-01-20',
      installedAt: '2026-02-01',
      equipmentId: 'eq-1',
      lifecycle: 'in_operation',
    })
  })

  it('ignores unposted and deleted documents', () => {
    const p = one({
      releases: [
        ...chain.slice(0, 2),
        { ...chain[2], Posted: false },
        release({
          Ref_Key: 'd',
          Number: '4',
          Date: '2026-03-01T00:00:00',
          Статус: 'Списан',
          DeletionMark: true,
        }),
      ],
    })
    expect(p).toMatchObject({ installedAt: null, lifecycle: 'shipped', equipmentId: null })
  })

  it('orders equal dates by document number', () => {
    const same = '2026-05-05T10:00:00'
    const p = one({
      releases: [
        release({ Ref_Key: 'x', Number: '000000010', Date: same, Статус: 'Отгружен' }),
        release({ Ref_Key: 'y', Number: '000000009', Date: same, Статус: 'НаСкладе' }),
      ],
    })
    expect(p.lifecycle).toBe('shipped')
  })

  it('puts an item on a machine only from shipment on, however early the document names one', () => {
    const inStock = release({ Статус: 'НаСкладе', ГаражныйНомер_Key: 'eq-1' })
    expect(one({ releases: [inStock] }).equipmentId).toBeNull()
    expect(one({ releases: [{ ...inStock, Статус: 'Отгружен' }] }).equipmentId).toBe('eq-1')
  })

  it('has no dates for an item 1С never released', () => {
    expect(one()).toMatchObject({ manufacturedAt: null, shippedAt: null, installedAt: null })
  })

  it('maps the empty status to manufacturing and an unknown machine to none', () => {
    const p = one({ releases: [release({ Статус: '', ГаражныйНомер_Key: 'not-in-catalogue' })] })
    expect(p).toMatchObject({ lifecycle: 'manufacturing', equipmentId: null })
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
    const installed = release({ Статус: 'ВЭксплуатации', Date: '2026-01-01T00:00:00' })
    expect(one({ releases: [installed] }).status).toBe('no_warranty') // past 180 days of warranty
    expect(one({ releases: [{ ...installed, Date: '2026-08-01T00:00:00' }] }).status).toBe('ok')
    expect(one({ releases: [{ ...installed, Date: '2025-09-01T00:00:00' }] }).status).toBe(
      'replace',
    )
  })

  it('counts from shipment when there is no installation, and gives up without either', () => {
    const shipped = release({ Статус: 'Отгружен', Date: '2026-08-15T00:00:00' })
    expect(one({ releases: [shipped] }).status).toBe('ok')
    expect(one().status).toBe('no_warranty')
  })

  it('links the replaced item and the branch of the customer', () => {
    const p = one({ items: [item({ ЗаменяемоеИзделие_Key: 'old-1' })] })
    expect(p).toMatchObject({ replacedProductId: 'old-1', branchId: 'branch-1' })
    expect(
      one({ items: [item({ ЗаменяемоеИзделие_Key: ZERO_GUID })] }).replacedProductId,
    ).toBeNull()
  })

  it('does not call an item overdue when 1С gives it no service life', () => {
    const shipped = release({ Статус: 'Отгружен', Date: '2026-08-15T00:00:00' })
    const p = one({ items: [item({ СрокПолезногоИспользования: '0' })], releases: [shipped] })
    expect(p).toMatchObject({ serviceLifeDays: 0, status: 'no_warranty' })
  })

  it('reads no warranty as zero days', () => {
    expect(one({ items: [item({ СрокГарантии: '0' })] }).warrantyDays).toBe(0)
  })
})
