import type { Db } from '../db/pool.ts'
import { toCatalogNumber } from '../onec/adapters/catalog.ts'
import { toEquipment } from '../onec/adapters/equipment.ts'
import { toHistory } from '../onec/adapters/history.ts'
import { toProducts } from '../onec/adapters/product.ts'
import type { ODataClient } from '../onec/client.ts'
import {
  fetchRegisterSince,
  fetchSources,
  fetchSourcesFor,
  fetchVersions,
  type Sources,
} from '../onec/sources.ts'
import { fetchOrderStates, refreshRequestStatuses } from '../requests/statuses.ts'
import { readHealth, recordSuccess } from './health.ts'
import { patchCache, storeCache, type Cache } from './store.ts'

export interface SyncResult {
  /** `full` rebuilt the cache; `check` patched what changed */
  mode: 'full' | 'check'
  products: number
  equipment: number
  /** Hoses read again from 1С (a check) or all of them (a rebuild) */
  refreshed: number
  /** Hoses gone from 1С since the last run */
  removed: number
  /** Requests whose 1С status or shipment changed */
  requestUpdates: number
  ms: number
}

/** More changed hoses than this, and a rebuild reads less than batches of keys would. */
export const CHECK_LIMIT = 500

/** A check rereads the register this far back: lines a document posts a little late. */
const MARGIN_MS = 60 * 60 * 1000

/** The latest register time seen, in 1С's own `YYYY-MM-DDTHH:mm:ss`. */
const markOf = (lines: { Period: string }[]) =>
  lines.reduce<string | null>((m, l) => (m === null || l.Period > m ? l.Period : m), null)

const earlier = (period: string, ms: number) =>
  new Date(new Date(`${period}Z`).getTime() - ms).toISOString().slice(0, 19)

/** The adapted cache for what was read, with each item's owner and version. */
function adapt(sources: Sources): Cache {
  const item = new Map(sources.items.map((i) => [i.Ref_Key, i]))
  const products = toProducts(sources)
  // What sits on a machine is counted at read time; the cache keeps no counts, so a check
  // (which sees only the hoses it read) writes the same machines a rebuild does.
  const equipment = toEquipment({ ...sources, products: [] })
  const machineOwner = new Map(sources.equipment.map((e) => [e.Ref_Key, e.Owner_Key]))
  const components = new Map(sources.components.map((c) => [c.Ref_Key, c]))
  return {
    products: products.map((product) => ({
      product,
      clientId: item.get(product.id)?.Клиент_Key ?? '',
      version: item.get(product.id)?.DataVersion,
    })),
    history: toHistory(sources),
    equipment: equipment.map((e) => ({ equipment: e, clientId: machineOwner.get(e.id) ?? '' })),
    catalog: sources.catalogNumbers
      .filter((c) => !c.DeletionMark)
      .map((c) => toCatalogNumber(c, components)),
  }
}

const statusesOf = (db: Db, client: ODataClient) =>
  refreshRequestStatuses(db, (refs) => fetchOrderStates(client, refs))

/** Full sync: read 1С, adapt, replace the cache. Nightly, and whenever a check cannot do. */
export async function runSync(
  db: Db,
  client: ODataClient,
  /** Where request statuses are read; 1С itself unless a stand-in says otherwise (Д20) */
  states: ODataClient = client,
): Promise<SyncResult> {
  const started = Date.now()
  const sources = await fetchSources(client)
  const cache = adapt(sources)
  await storeCache(db, cache, Date.now() - started)
  await recordSuccess(db, true, markOf(sources.statuses))
  const requestUpdates = await statusesOf(db, states)
  return {
    mode: 'full',
    products: cache.products.length,
    equipment: cache.equipment?.length ?? 0,
    refreshed: cache.products.length,
    removed: 0,
    requestUpdates,
    ms: Date.now() - started,
  }
}

/**
 * A check (Д26): every item's 1С version against the cache's, and the register
 * lines since the last run, find the hoses that changed; only those are read
 * again and written. A version 1С does not bump — a document reposted with an
 * old date, a machine renamed — waits for the nightly rebuild. With nothing
 * synced yet, or too much changed, it rebuilds instead.
 */
export async function runCheck(
  db: Db,
  client: ODataClient,
  states: ODataClient = client,
): Promise<SyncResult> {
  const started = Date.now()
  const { register_mark: mark } = await readHealth(db)
  if (!mark) return runSync(db, client, states)
  const [versions, lines, cached] = await Promise.all([
    fetchVersions(client),
    fetchRegisterSince(client, earlier(mark, MARGIN_MS)),
    db.query<{ id: string; onec_version: string | null }>('select id, onec_version from products'),
  ])
  const known = new Map(cached.rows.map((r) => [r.id, r.onec_version]))
  const live = new Set(versions.filter((v) => !v.DeletionMark).map((v) => v.Ref_Key))
  const affected = [
    ...new Set(
      [
        ...versions.filter((v) => live.has(v.Ref_Key) && known.get(v.Ref_Key) !== v.DataVersion),
        ...lines.filter((l) => live.has(l.Изделие_Key)).map((l) => ({ Ref_Key: l.Изделие_Key })),
      ].map((v) => v.Ref_Key),
    ),
  ]
  // A hose 1С deleted or marked; one the adapters drop (never a product) is not in the cache at all.
  const removed = [...known.keys()].filter((id) => !live.has(id))
  if (affected.length > CHECK_LIMIT) return runSync(db, client, states)

  let products = 0
  let equipment = 0
  if (affected.length || removed.length) {
    const patch = affected.length
      ? adapt(await fetchSourcesFor(client, affected))
      : { products: [], history: new Map(), equipment: undefined }
    await patchCache(db, { ...patch, removed }, Date.now() - started)
    products = patch.products.length
    equipment = patch.equipment?.length ?? 0
  }
  await recordSuccess(db, false, markOf(lines))
  const requestUpdates = await statusesOf(db, states)
  return {
    mode: 'check',
    products,
    equipment,
    refreshed: affected.length,
    removed: removed.length,
    requestUpdates,
    ms: Date.now() - started,
  }
}
