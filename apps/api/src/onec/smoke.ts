import { loadConfig } from '../config.ts'
import { toEquipment } from './adapters/equipment.ts'
import { toProducts } from './adapters/product.ts'
import { ODataClient } from './client.ts'
import { fetchSources } from './sources.ts'

/**
 * Live check: read 1С, adapt, print what came out. `npm run onec:smoke -w @rvd/api`.
 * Prints counts and aggregates only, never customer rows.
 */
const config = loadConfig()
const client = new ODataClient({
  baseUrl: config.ODATA_URL,
  user: config.ODATA_USER,
  password: config.ODATA_PASSWORD,
  timeoutMs: config.ODATA_TIMEOUT_MS,
})

const started = Date.now()
const src = await fetchSources(client)
console.log(`read in ${((Date.now() - started) / 1000).toFixed(1)}s:`, {
  items: src.items.length,
  statusRecords: src.statuses.length,
  releases: src.releases.length,
  catalogNumbers: src.catalogNumbers.length,
  equipment: src.equipment.length,
})

const products = toProducts(src)
const tally = <T>(rows: T[], key: (r: T) => string | null) => {
  const out: Record<string, number> = {}
  for (const r of rows) out[key(r) ?? '—'] = (out[key(r) ?? '—'] ?? 0) + 1
  return out
}
console.log('products', products.length)
console.log(
  'lifecycle',
  tally(products, (p) => p.lifecycle),
)
console.log(
  'status',
  tally(products, (p) => p.status),
)
console.log('with shipment date', products.filter((p) => p.shippedAt).length)
console.log('with install date', products.filter((p) => p.installedAt).length)
console.log('on a machine', products.filter((p) => p.equipmentId).length)
console.log('with catalogue number', products.filter((p) => p.catalogNumberId).length)
console.log('no service life', products.filter((p) => p.serviceLifeDays === 0).length)
console.log('no branch', products.filter((p) => !p.branchId).length)

const equipment = toEquipment({ ...src, products })
console.log(
  'equipment',
  equipment.length,
  'with hoses',
  equipment.filter((e) => e.hoseCount > 0).length,
)
