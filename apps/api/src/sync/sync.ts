import type { Db } from '../db/pool.ts'
import { toEquipment } from '../onec/adapters/equipment.ts'
import { toHistory } from '../onec/adapters/history.ts'
import { toProducts } from '../onec/adapters/product.ts'
import type { ODataClient } from '../onec/client.ts'
import { fetchSources } from '../onec/sources.ts'
import { storeCache } from './store.ts'

export interface SyncResult {
  products: number
  equipment: number
  ms: number
}

/** Full sync: read 1С, adapt, replace the cache. */
export async function runSync(db: Db, client: ODataClient): Promise<SyncResult> {
  const started = Date.now()
  const sources = await fetchSources(client)
  const owner = new Map(sources.items.map((i) => [i.Ref_Key, i.Клиент_Key]))
  const products = toProducts(sources)
  const equipment = toEquipment({ ...sources, products })
  const machineOwner = new Map(sources.equipment.map((e) => [e.Ref_Key, e.Owner_Key]))
  await storeCache(
    db,
    {
      products: products.map((product) => ({ product, clientId: owner.get(product.id) ?? '' })),
      history: toHistory(sources),
      equipment: equipment.map((e) => ({ equipment: e, clientId: machineOwner.get(e.id) ?? '' })),
    },
    Date.now() - started,
  )
  return { products: products.length, equipment: equipment.length, ms: Date.now() - started }
}
