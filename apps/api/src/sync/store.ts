import type { PoolClient } from 'pg'
import type { CatalogNumber, Equipment, LifecycleRecord, Product } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import type { Discrepancy } from '../onec/adapters/discrepancies.ts'

/** What the cache filters by but the contract does not carry: who owns the item, its 1С version. */
export interface StoredProduct {
  product: Product
  clientId: string
  /** 1С `DataVersion` of the item, so a check (Д26) sees whether it changed */
  version?: string
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
  /** The supplier's catalogue numbers, rewritten whole each time */
  catalog?: CatalogNumber[]
}

/** What a check (Д26) found changed: these hoses anew, those gone, and every machine. */
export interface CachePatch extends Cache {
  /** Hoses 1С deleted or marked for deletion */
  removed: string[]
}

type Tx = PoolClient

const CHUNK = 1000

/** What the registry's search looks through: the hose's numbers and name, its machine and place. */
export const searchText = (p: Product, garageNumber: string | null | undefined) =>
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

async function inTransaction(db: Db, work: (tx: Tx) => Promise<void>): Promise<void> {
  const tx = await db.connect()
  try {
    await tx.query('begin')
    await work(tx)
    await tx.query('commit')
  } catch (error) {
    await tx.query('rollback')
    throw error
  } finally {
    tx.release()
  }
}

async function writeCatalog(tx: Tx, catalog: CatalogNumber[] | undefined) {
  if (!catalog) return
  await tx.query('delete from catalog_numbers')
  await tx.query(
    `insert into catalog_numbers
       select * from jsonb_to_recordset($1::jsonb) as r(id text, name text, data jsonb)`,
    [JSON.stringify(catalog.map((c) => ({ id: c.id, name: c.name, data: c })))],
  )
}

async function writeEquipment(tx: Tx, machines: StoredEquipment[]) {
  await tx.query('delete from equipment')
  // What the customer recorded (department, factory number) lies over 1С's empty fields.
  const { rows: local } = await tx.query<{
    equipment_id: string
    department: string | null
    factory_number: string | null
  }>('select equipment_id, department, factory_number from equipment_local')
  const own = new Map(local.map((l) => [l.equipment_id, l]))
  for (let i = 0; i < machines.length; i += CHUNK) {
    const chunk = machines.slice(i, i + CHUNK).map(({ equipment, clientId }) => {
      const l = own.get(equipment.id)
      const e = l
        ? { ...equipment, department: l.department, factoryNumber: l.factory_number }
        : equipment
      return {
        id: e.id,
        client_id: clientId,
        branch_id: e.branchId,
        garage_number: e.garageNumber,
        data: e,
      }
    })
    await tx.query(
      `insert into equipment
         select * from jsonb_to_recordset($1::jsonb) as r(
           id text, client_id text, branch_id text, garage_number text, data jsonb)`,
      [JSON.stringify(chunk)],
    )
  }
}

async function writeProducts(
  tx: Tx,
  rows: StoredProduct[],
  history: ReadonlyMap<string, LifecycleRecord[]>,
  garages: ReadonlyMap<string, string>,
) {
  const histories = [...history].map(([product_id, records]) => ({ product_id, records }))
  for (let i = 0; i < histories.length; i += CHUNK) {
    await tx.query(
      `insert into product_history
         select * from jsonb_to_recordset($1::jsonb) as r(product_id text, records jsonb)`,
      [JSON.stringify(histories.slice(i, i + CHUNK))],
    )
  }
  // What the customer recorded (place, own number) lies over 1С's empty fields on every write.
  const { rows: local } = await tx.query<{
    product_id: string
    install_place: string | null
    client_number: string | null
  }>('select product_id, install_place, client_number from product_local')
  const own = new Map(local.map((l) => [l.product_id, l]))
  const withLocal = (p: Product): Product => {
    const l = own.get(p.id)
    return l ? { ...p, installPlace: l.install_place, clientNumber: l.client_number } : p
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map(({ product, clientId, version }) => {
      const p = withLocal(product)
      return {
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
        onec_version: version ?? null,
      }
    })
    await tx.query(
      `insert into products
         select * from jsonb_to_recordset($1::jsonb) as r(
           id text, client_id text, branch_id text, equipment_id text, catalog_number_id text,
           serial_number text, type text, lifecycle text, shipped_at date, installed_at date,
           warranty_days int, service_life_days int, search text, data jsonb,
           replaced_product_id text, onec_version text)`,
      [JSON.stringify(chunk)],
    )
  }
}

const countState = (tx: Tx, durationMs: number) =>
  tx.query(
    `insert into sync_state (entity, synced_at, rows, duration_ms)
       values ('products', now(), (select count(*) from products), $1),
              ('equipment', now(), (select count(*) from equipment), $1)
     on conflict (entity) do update set synced_at = excluded.synced_at, rows = excluded.rows, duration_ms = excluded.duration_ms`,
    [durationMs],
  )

const garagesOf = (machines: StoredEquipment[]) =>
  new Map(machines.map(({ equipment: e }) => [e.id, e.garageNumber]))

/**
 * Replaces the hoses, their histories and the machines in one transaction, so
 * a reader never sees a half-synced cache or a hose that disagrees with its
 * machine. The nightly full rebuild; checks in between patch (`patchCache`).
 */
export async function storeCache(db: Db, cache: Cache, durationMs: number): Promise<void> {
  const machines = cache.equipment ?? []
  await inTransaction(db, async (tx) => {
    await tx.query('delete from products')
    await tx.query('delete from product_history')
    await writeEquipment(tx, machines)
    await writeCatalog(tx, cache.catalog)
    await writeProducts(tx, cache.products, cache.history ?? new Map(), garagesOf(machines))
    await countState(tx, durationMs)
  })
}

/**
 * Writes what a check found (Д26) in one transaction: the changed hoses and
 * their histories anew, the removed ones gone, every machine replaced (a few
 * hundred rows). Other hoses keep their rows, so a machine renamed in between
 * reaches their search text only at the nightly rebuild.
 */
export async function patchCache(db: Db, patch: CachePatch, durationMs: number): Promise<void> {
  const machines = patch.equipment ?? []
  const ids = [...patch.products.map((r) => r.product.id), ...patch.removed]
  await inTransaction(db, async (tx) => {
    await tx.query('delete from products where id = any($1)', [ids])
    await tx.query('delete from product_history where product_id = any($1)', [ids])
    if (patch.equipment) await writeEquipment(tx, machines)
    await writeCatalog(tx, patch.catalog)
    const garages = patch.equipment
      ? garagesOf(machines)
      : new Map(
          (
            await tx.query<{ id: string; garage_number: string }>(
              'select id, garage_number from equipment',
            )
          ).rows.map((r) => [r.id, r.garage_number]),
        )
    await writeProducts(tx, patch.products, patch.history ?? new Map(), garages)
    await countState(tx, durationMs)
  })
}

/**
 * Keeps `data_issues` to what the rebuild just found (question 24): a new disagreement is
 * added, one still there keeps its date and letter, one gone is closed. One that comes back
 * after it was closed is found anew and goes out in a letter again.
 */
export async function recordDataIssues(db: Db, found: Discrepancy[]): Promise<void> {
  await inTransaction(db, async (tx) => {
    await tx.query(
      `insert into data_issues (key, kind, product_id, text)
         select key, kind, "productId", text
         from jsonb_to_recordset($1::jsonb) as r(key text, kind text, "productId" text, text text)
       on conflict (key) do update set
         text = excluded.text,
         found_at = case when data_issues.resolved_at is null then data_issues.found_at else now() end,
         notified_at = case when data_issues.resolved_at is null then data_issues.notified_at end,
         notify_error = case when data_issues.resolved_at is null then data_issues.notify_error end,
         resolved_at = null`,
      [JSON.stringify(found)],
    )
    await tx.query(
      'update data_issues set resolved_at = now() where resolved_at is null and not (key = any($1))',
      [found.map((d) => d.key)],
    )
  })
}
