import type { Db } from '../db/pool.ts'
import { toCatalogNumber } from '../onec/adapters/catalog.ts'
import { findDiscrepancies } from '../onec/adapters/discrepancies.ts'
import { toEquipment } from '../onec/adapters/equipment.ts'
import { toHistory } from '../onec/adapters/history.ts'
import { replacedBy, toProducts } from '../onec/adapters/product.ts'
import type { ODataClient } from '../onec/client.ts'
import {
  fetchClients,
  fetchRegisterSince,
  fetchSources,
  fetchSourcesFor,
  fetchReleaseVersions,
  fetchVersions,
  itemsRecordedBy,
  type Sources,
} from '../onec/sources.ts'
import { fetchOrders, importOrders } from '../requests/orders1c.ts'
import { fetchOrderStates, refreshRequestStatuses } from '../requests/statuses.ts'
import { readHealth, recordSuccess } from './health.ts'
import { patchCache, recordDataIssues, storeCache, type Cache } from './store.ts'

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
  /** Orders made in 1С itself, written to «Заявки» (new or changed) */
  orders: number
  /** Data 1С keeps twice and differently (question 24); only a rebuild looks */
  discrepancies?: number
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
function adapt(sources: Sources, replaced?: string[]): Cache {
  const item = new Map(sources.items.map((i) => [i.Ref_Key, i]))
  const products = toProducts(sources, { replaced })
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

type DocumentVersion = { Ref_Key: string; DataVersion: string }

/** Remembers the «Выпуск» versions just read, so the next check sees only what moved after. */
async function storeDocumentVersions(db: Db, docs: DocumentVersion[]) {
  if (!docs.length) return
  await db.query(
    `insert into onec_documents (ref, version)
     select r.ref, r.version from jsonb_to_recordset($1::jsonb) as r(ref text, version text)
     on conflict (ref) do update set version = excluded.version`,
    [JSON.stringify(docs.map((d) => ({ ref: d.Ref_Key, version: d.DataVersion })))],
  )
}

const statusesOf = (db: Db, client: ODataClient) =>
  refreshRequestStatuses(db, (refs) => fetchOrderStates(client, refs))

/** A check looks back this many days for orders made in 1С; the nightly rebuild reads them all. */
const ORDER_DAYS = 3

const ordersOf = (db: Db, client: ODataClient, since?: string) =>
  fetchOrders(client, since).then((orders) => importOrders(db, orders))

/**
 * The changed hoses adapted. A hose named as replaced is written off (the 1С developer,
 * 2026-10-17), so one a changed hose names is read and written again too, and one read
 * alone keeps the write-off a cached hose's link gives it. A link 1С takes back waits
 * for the nightly rebuild.
 */
async function adaptSome(db: Db, client: ODataClient, ids: string[], live: Set<string>) {
  const sources = await fetchSourcesFor(client, ids)
  const named = replacedBy(sources.items).filter((id) => live.has(id) && !ids.includes(id))
  const { rows } = await db.query<{ id: string }>(
    `select distinct replaced_product_id as id from products
       where replaced_product_id is not null and id <> all($1)`,
    [ids],
  )
  return adapt(
    named.length ? await fetchSourcesFor(client, [...ids, ...new Set(named)]) : sources,
    rows.map((r) => r.id),
  )
}

/**
 * Full sync: read 1С, adapt, replace the cache. Nightly, and whenever a check cannot do.
 * Having every item at hand, it also looks for data 1С keeps twice and differently.
 */
export async function runSync(
  db: Db,
  client: ODataClient,
  /** Where request statuses are read; 1С itself unless a stand-in says otherwise (Д20) */
  states: ODataClient = client,
): Promise<SyncResult> {
  const started = Date.now()
  const [sources, clients, documents] = await Promise.all([
    fetchSources(client),
    fetchClients(client),
    fetchReleaseVersions(client),
  ])
  const cache = adapt(sources)
  await storeCache(db, cache, Date.now() - started)
  await storeDocumentVersions(db, documents)
  await recordSuccess(db, true, markOf(sources.statuses))
  const orders = await ordersOf(db, client)
  const requestUpdates = await statusesOf(db, states)
  const discrepancies = findDiscrepancies({ ...sources, clients })
  await recordDataIssues(db, discrepancies)
  return {
    mode: 'full',
    products: cache.products.length,
    equipment: cache.equipment?.length ?? 0,
    refreshed: cache.products.length,
    removed: 0,
    requestUpdates,
    orders,
    discrepancies: discrepancies.length,
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
  const [versions, lines, cached, documents, seenDocuments] = await Promise.all([
    fetchVersions(client),
    fetchRegisterSince(client, earlier(mark, MARGIN_MS)),
    db.query<{ id: string; onec_version: string | null }>('select id, onec_version from products'),
    fetchReleaseVersions(client),
    db.query<{ ref: string; version: string }>('select ref, version from onec_documents'),
  ])
  // A «Выпуск» reposted since the last run, even back-dated: its hoses are read again.
  // Before the first rebuild stored any versions there is nothing to compare with.
  const seen = new Map(seenDocuments.rows.map((r) => [r.ref, r.version]))
  const moved = seen.size
    ? documents.filter((d) => seen.get(d.Ref_Key) !== d.DataVersion).map((d) => d.Ref_Key)
    : []
  const reposted = moved.length ? await itemsRecordedBy(client, moved) : []
  const known = new Map(cached.rows.map((r) => [r.id, r.onec_version]))
  const live = new Set(versions.filter((v) => !v.DeletionMark).map((v) => v.Ref_Key))
  const affected = [
    ...new Set(
      [
        ...versions.filter((v) => live.has(v.Ref_Key) && known.get(v.Ref_Key) !== v.DataVersion),
        ...lines.filter((l) => live.has(l.Изделие_Key)).map((l) => ({ Ref_Key: l.Изделие_Key })),
        ...reposted.filter((id) => live.has(id)).map((id) => ({ Ref_Key: id })),
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
      ? await adaptSome(db, client, affected, live)
      : { products: [], history: new Map(), equipment: undefined }
    await patchCache(db, { ...patch, removed }, Date.now() - started)
    products = patch.products.length
    equipment = patch.equipment?.length ?? 0
  }
  await recordSuccess(db, false, markOf(lines))
  await storeDocumentVersions(
    db,
    documents.filter((d) => seen.get(d.Ref_Key) !== d.DataVersion),
  )
  const since = new Date(Date.now() - ORDER_DAYS * 86_400_000).toISOString().slice(0, 10)
  const orders = await ordersOf(db, client, since)
  const requestUpdates = await statusesOf(db, states)
  return {
    mode: 'check',
    products,
    equipment,
    refreshed: affected.length,
    removed: removed.length,
    requestUpdates,
    orders,
    ms: Date.now() - started,
  }
}
