import type { Equipment, LifecycleRecord, Product } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'

/** What the cache filters by but the contract does not carry: who owns the item. */
export interface StoredProduct {
  product: Product
  clientId: string
}

/** A machine and its owner; its hose counts are worked out at read time. */
export interface StoredEquipment {
  equipment: Equipment
  clientId: string
}

/** Everything one sync writes, replaced together. */
export interface Cache {
  products: StoredProduct[]
  /** Each hose's lines in the statuses register */
  history?: ReadonlyMap<string, LifecycleRecord[]>
  equipment?: StoredEquipment[]
}

const CHUNK = 1000

/** What the registry's search looks through: the hose's numbers and name, its machine and place. */
const searchText = (p: Product, garageNumber: string | undefined) =>
  [
    p.serialNumber,
    p.clientNumber,
    p.catalogNumber,
    p.nomenclatureNumber,
    p.type,
    garageNumber,
    p.installPlace,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/**
 * Replaces the hoses, their histories and the machines in one transaction, so
 * a reader never sees a half-synced cache or a hose that disagrees with its
 * machine. Incremental sync (Д26) will replace this with a diff.
 */
export async function storeCache(db: Db, cache: Cache, durationMs: number): Promise<void> {
  const rows = cache.products
  const history = cache.history ?? new Map<string, LifecycleRecord[]>()
  const machines = cache.equipment ?? []
  const garages = new Map(machines.map(({ equipment: e }) => [e.id, e.garageNumber]))
  const client = await db.connect()
  try {
    await client.query('begin')
    await client.query('delete from products')
    await client.query('delete from product_history')
    await client.query('delete from equipment')
    for (let i = 0; i < machines.length; i += CHUNK) {
      const chunk = machines.slice(i, i + CHUNK).map(({ equipment: e, clientId }) => ({
        id: e.id,
        client_id: clientId,
        branch_id: e.branchId,
        garage_number: e.garageNumber,
        data: e,
      }))
      await client.query(
        `insert into equipment
           select * from jsonb_to_recordset($1::jsonb) as r(
             id text, client_id text, branch_id text, garage_number text, data jsonb)`,
        [JSON.stringify(chunk)],
      )
    }
    const histories = [...history].map(([product_id, records]) => ({ product_id, records }))
    for (let i = 0; i < histories.length; i += CHUNK) {
      await client.query(
        `insert into product_history
           select * from jsonb_to_recordset($1::jsonb) as r(product_id text, records jsonb)`,
        [JSON.stringify(histories.slice(i, i + CHUNK))],
      )
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map(({ product: p, clientId }) => ({
        id: p.id,
        client_id: clientId,
        branch_id: p.branchId,
        equipment_id: p.equipmentId,
        catalog_number_id: p.catalogNumberId,
        serial_number: p.serialNumber,
        type: p.type,
        lifecycle: p.lifecycle,
        shipped_at: p.shippedAt,
        installed_at: p.installedAt,
        warranty_days: p.warrantyDays,
        service_life_days: p.serviceLifeDays,
        search: searchText(p, p.equipmentId ? garages.get(p.equipmentId) : undefined),
        data: p,
        replaced_product_id: p.replacedProductId,
      }))
      await client.query(
        `insert into products
           select * from jsonb_to_recordset($1::jsonb) as r(
             id text, client_id text, branch_id text, equipment_id text, catalog_number_id text,
             serial_number text, type text, lifecycle text, shipped_at date, installed_at date,
             warranty_days int, service_life_days int, search text, data jsonb,
             replaced_product_id text)`,
        [JSON.stringify(chunk)],
      )
    }
    await client.query(
      `insert into sync_state (entity, synced_at, rows, duration_ms)
         values ('products', now(), $1, $3), ('equipment', now(), $2, $3)
       on conflict (entity) do update set synced_at = excluded.synced_at, rows = excluded.rows, duration_ms = excluded.duration_ms`,
      [rows.length, machines.length, durationMs],
    )
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
