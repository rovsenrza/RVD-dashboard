import type { RequestPosition } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { isRef } from '../onec/adapters/common.ts'
import type { ODataClient } from '../onec/client.ts'
import { requestStatusFrom1C } from '../onec/orders.ts'

/** «Заказ клиента» as the cabinet reads it, with its lines. */
export interface RawOrder {
  Ref_Key: string
  DeletionMark: boolean
  /** An order not posted is a draft */
  Posted: boolean
  Number: string
  Date: string
  Клиент_Key: string
  СтатусЗаказа: string
  Отгрузка: string
  Комментарий?: string
  Изделия?: { Изделие_Key: string; Техника_Key: string; КаталожныйНомер_Key: string }[]
}

/**
 * Reads the orders 1С holds, all of them or those dated since a day — the marked
 * and the drafts too, so that one the cabinet already shows can be taken out.
 */
export function fetchOrders(client: ODataClient, since?: string): Promise<RawOrder[]> {
  return client.all<RawOrder>('Document_ЗаказыКлиента', {
    select: [
      'Ref_Key',
      'DeletionMark',
      'Posted',
      'Number',
      'Date',
      'Клиент_Key',
      'СтатусЗаказа',
      'Отгрузка',
      'Комментарий',
      'Изделия',
    ],
    filter: since ? `Date ge datetime'${since}T00:00:00'` : undefined,
  })
}

const ref = (key: string | undefined) => (key && isRef(key) ? key : null)

/**
 * The orders made in 1С itself land in «Заявки» beside the cabinet's own
 * (customer, 2026-10-12: «как в 1С», so a company sees its whole history). Each
 * is a request of kind `order`, already delivered, under `1c-<Ref_Key>`; a
 * later run refreshes its status and shipment, and stamps `closed_at` when it
 * first sees the order closed, as for the cabinet's requests. Orders the
 * cabinet itself sent are left to their own rows.
 *
 * Drafts and orders marked for deletion are not shown, and one shown before goes
 * (customer, 2026-10-22). With `complete` — every order 1С holds, not a recent
 * slice — an order 1С no longer has at all goes too. Returns the rows written or removed.
 */
export async function importOrders(
  db: Db,
  all: RawOrder[],
  { complete = false }: { complete?: boolean } = {},
): Promise<number> {
  if (!all.length) return 0
  const orders = all.filter((o) => o.Posted && !o.DeletionMark)
  const hidden = all.filter((o) => !o.Posted || o.DeletionMark).map((o) => `1c-${o.Ref_Key}`)
  const gone = await db.query(
    complete
      ? `delete from requests where kind = 'order' and (id = any($1) or onec_ref <> all($2))`
      : `delete from requests where kind = 'order' and id = any($1)`,
    complete ? [hidden, orders.map((o) => o.Ref_Key)] : [hidden],
  )
  const removed = gone.rowCount ?? 0
  if (!orders.length) return removed
  // What each line's hose is, for the catalogue number the list shows.
  const items = [
    ...new Set(orders.flatMap((o) => (o.Изделия ?? []).map((l) => ref(l.Изделие_Key)))),
  ].filter((id): id is string => id !== null)
  const { rows: known } = await db.query<{ id: string; cid: string | null; cn: string | null }>(
    `select id, data->>'catalogNumberId' as cid, data->>'catalogNumber' as cn
     from products where id = any($1)`,
    [items],
  )
  const hose = new Map(known.map((k) => [k.id, k]))

  const rows = orders.map((o) => {
    const positions: RequestPosition[] = (o.Изделия ?? []).map((l) => {
      const h = hose.get(ref(l.Изделие_Key) ?? '')
      return {
        productId: null,
        catalogNumberId: ref(l.КаталожныйНомер_Key) ?? h?.cid ?? null,
        catalogNumber: h?.cn ?? null,
        equipmentId: ref(l.Техника_Key),
        quantity: 1,
      }
    })
    return {
      id: `1c-${o.Ref_Key}`,
      client: o.Клиент_Key,
      positions,
      comment: o.Комментарий?.trim() || null,
      // The day as 1С dates it, whatever the server's zone.
      created: `${o.Date.slice(0, 10)}T12:00:00Z`,
      ref: o.Ref_Key,
      number: o.Number.trim(),
      status: requestStatusFrom1C(o.СтатусЗаказа) ?? 'new',
      shipment: o.Отгрузка === 'Отгружен' ? 'shipped' : 'not_shipped',
    }
  })

  const result = await db.query(
    `insert into requests (id, client_id, branch_id, kind, positions, comment, author, created_at,
       delivery, onec_ref, number, status, shipment_status)
     select r.id, r.client, r.client, 'order', r.positions, r.comment,
       '{"name": "1С", "email": null}', r.created::timestamptz, 'delivered', r.ref, r.number,
       r.status, r.shipment
     from jsonb_to_recordset($1::jsonb) as r(id text, client text, positions jsonb, comment text,
       created text, ref text, number text, status text, shipment text)
     where not exists (
       select 1 from requests c where c.onec_ref = r.ref and c.kind <> 'order'
     )
     on conflict (id) do update set
       positions = excluded.positions, comment = excluded.comment, number = excluded.number,
       status = excluded.status, shipment_status = excluded.shipment_status,
       closed_at = case when excluded.status in ('done', 'rejected')
                        then coalesce(requests.closed_at, now()) end
     where (requests.status, requests.shipment_status, requests.number, requests.positions)
       is distinct from (excluded.status, excluded.shipment_status, excluded.number, excluded.positions)`,
    [JSON.stringify(rows)],
  )
  // An order the cabinet sent may have come in here before its own row learnt the order's key.
  await db.query(
    `delete from requests o where o.kind = 'order'
       and exists (select 1 from requests c where c.onec_ref = o.onec_ref and c.kind <> 'order')`,
  )
  return removed + (result.rowCount ?? 0)
}
