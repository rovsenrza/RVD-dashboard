import type { Product } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'

/** What the cache filters by but the contract does not carry: who owns the item. */
export interface StoredProduct {
  product: Product
  clientId: string
}

const CHUNK = 1000

const searchText = (p: Product) =>
  [p.serialNumber, p.catalogNumber, p.nomenclatureNumber, p.type]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/**
 * Replaces the whole products table in one transaction, so a reader never sees
 * a half-synced cache. Incremental sync (Д26) will replace this with a diff.
 */
export async function storeProducts(
  db: Db,
  rows: StoredProduct[],
  durationMs: number,
): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('begin')
    await client.query('delete from products')
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
        search: searchText(p),
        data: p,
      }))
      await client.query(
        `insert into products
           select * from jsonb_to_recordset($1::jsonb) as r(
             id text, client_id text, branch_id text, equipment_id text, catalog_number_id text,
             serial_number text, type text, lifecycle text, shipped_at date, installed_at date,
             warranty_days int, service_life_days int, search text, data jsonb)`,
        [JSON.stringify(chunk)],
      )
    }
    await client.query(
      `insert into sync_state (entity, synced_at, rows, duration_ms) values ('products', now(), $1, $2)
       on conflict (entity) do update set synced_at = excluded.synced_at, rows = excluded.rows, duration_ms = excluded.duration_ms`,
      [rows.length, durationMs],
    )
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
