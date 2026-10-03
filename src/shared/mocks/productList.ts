import type { Product, ProductPage } from '@/entities/types'
import type { ProductListQuery, ProductSortKey } from '@/entities/product/list'
import { serviceDates } from '@/entities/product/rules'
import { equipment, settings } from './data'

type Value = string | number | null

/** What each sort compares, in the order the API sorts by (apps/api/src/products/query.ts). */
const SORT: Record<ProductSortKey, (p: Product) => Value[]> = {
  // Serial numbers sort as numbers: the shorter one first, then digit by digit.
  serialNumber: (p) => [p.serialNumber.length, p.serialNumber],
  clientNumber: (p) => [p.clientNumber],
  type: (p) => [p.type],
  catalogNumber: (p) => [p.catalogNumber],
  manufacturer: (p) => [p.manufacturer],
  shippedAt: (p) => [p.shippedAt],
  installedAt: (p) => [p.installedAt],
  plannedAt: (p) => [serviceDates(p, settings)?.plannedAt ?? null],
  status: (p) => [['replace', 'warn', 'no_warranty', 'ok'].indexOf(p.status)],
  lifecycle: (p) => [p.lifecycle],
  installPlace: (p) => [p.installPlace],
}

/** Empty values go last whichever way the column sorts, as `nulls last` does on the server. */
function compare(a: Value[], b: Value[], dir: 1 | -1) {
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x === y) continue
    if (x === null) return 1
    if (y === null) return -1
    const order =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'ru')
    if (order) return order * dir
  }
  return 0
}

const archived = (p: Product) => p.lifecycle === 'written_off'

/**
 * `GET /products` as the API answers it: filtered, searched, sorted and paged,
 * with both tabs counted under the same filters.
 */
export function productPage(all: Product[], query: ProductListQuery): ProductPage {
  const garages = new Map(equipment.map((e) => [e.id, e.garageNumber]))
  const q = query.q?.toLowerCase()
  const searchText = (p: Product) =>
    [
      p.serialNumber,
      p.clientNumber,
      p.catalogNumber,
      p.nomenclatureNumber,
      p.type,
      p.equipmentId && garages.get(p.equipmentId),
      p.installPlace,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

  const matches = all.filter(
    (p) =>
      (!q || searchText(p).includes(q)) &&
      (!query.status || p.status === query.status) &&
      (!query.lifecycle || p.lifecycle === query.lifecycle) &&
      (!query.equipment || p.equipmentId === query.equipment) &&
      (!query.catalog || p.catalogNumberId === query.catalog) &&
      (!query.branch || p.branchId === query.branch) &&
      (!query.installed || (query.installed === '1') === (p.installedAt !== null)),
  )
  const tab = query.archive
    ? matches.filter((p) => archived(p) === (query.archive === '1'))
    : matches
  const key = SORT[query.sort]
  const dir = query.dir === 'desc' ? -1 : 1
  const sorted = [...tab].sort((a, b) => compare(key(a), key(b), dir) || a.id.localeCompare(b.id))
  const start = (query.page - 1) * query.limit
  return {
    items: sorted.slice(start, start + query.limit),
    total: tab.length,
    page: query.page,
    limit: query.limit,
    counts: {
      active: matches.filter((p) => !archived(p)).length,
      archive: matches.filter(archived).length,
    },
  }
}
