import type { Db } from '../db/pool.ts'
import { toProducts } from '../onec/adapters/product.ts'
import type { ODataClient } from '../onec/client.ts'
import { fetchSources } from '../onec/sources.ts'
import { storeProducts } from './store.ts'

export interface SyncResult {
  products: number
  ms: number
}

/** Full sync: read 1С, adapt, replace the cache. */
export async function runSync(db: Db, client: ODataClient): Promise<SyncResult> {
  const started = Date.now()
  const sources = await fetchSources(client)
  const owner = new Map(sources.items.map((i) => [i.Ref_Key, i.Клиент_Key]))
  const products = toProducts(sources)
  await storeProducts(
    db,
    products.map((product) => ({ product, clientId: owner.get(product.id) ?? '' })),
    Date.now() - started,
  )
  return { products: products.length, ms: Date.now() - started }
}
