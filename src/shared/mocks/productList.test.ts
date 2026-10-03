import { ProductListQuery } from '@/entities/product/list'
import { equipment, products } from './data'
import { productPage } from './productList'

const page = (params: Record<string, string> = {}, list = products) =>
  productPage(list, ProductListQuery.parse(params))
const ids = (params: Record<string, string>, list = products) =>
  page(params, list).items.map((p) => p.id)

describe('the registry, paged as the API pages it', () => {
  it('pages with the total of the tab and counts both tabs', () => {
    const all = page({ limit: '10', page: '2' })
    expect(all.items).toHaveLength(10)
    expect(all.total).toBe(products.length)
    expect(all.counts.active + all.counts.archive).toBe(products.length)

    const archive = page({ archive: '1', limit: '5000' })
    expect(archive.total).toBe(all.counts.archive)
    expect(archive.items.every((p) => p.lifecycle === 'written_off')).toBe(true)
    expect(page({ archive: '0' }).total).toBe(all.counts.active)
  })

  it('sorts serial numbers as numbers and keeps empty values last either way', () => {
    const list = [
      { ...products[0], id: 'a', serialNumber: '100', installPlace: null },
      { ...products[1], id: 'b', serialNumber: '9', installPlace: 'Ковш' },
      { ...products[2], id: 'c', serialNumber: '10', installPlace: 'Стрела' },
    ]
    expect(ids({}, list)).toEqual(['b', 'c', 'a'])
    expect(ids({ dir: 'desc' }, list)).toEqual(['a', 'c', 'b'])
    expect(ids({ sort: 'installPlace' }, list)).toEqual(['b', 'c', 'a'])
    expect(ids({ sort: 'installPlace', dir: 'desc' }, list)).toEqual(['c', 'b', 'a'])
  })

  it('searches the machine’s garage number, and counts the tabs under the search', () => {
    const onMachine = products.find((p) => p.equipmentId)!
    const garage = equipment.find((e) => e.id === onMachine.equipmentId)!.garageNumber
    const found = page({ q: garage.toLowerCase(), limit: '5000' })
    expect(found.items.map((p) => p.id)).toContain(onMachine.id)
    expect(found.counts.active + found.counts.archive).toBe(found.total)
  })
})
