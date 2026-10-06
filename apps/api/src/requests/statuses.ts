import type { Db } from '../db/pool.ts'
import type { ODataClient } from '../onec/client.ts'
import { requestStatusFrom1C } from '../onec/orders.ts'

/** The part of «Заказ клиента» the cabinet follows. */
export interface OrderState {
  Ref_Key: string
  СтатусЗаказа: string
  Отгрузка: string
}

const CHUNK = 20

/** Reads the given orders from 1С by Ref_Key, a few at a time. */
export async function fetchOrderStates(client: ODataClient, refs: string[]): Promise<OrderState[]> {
  const out: OrderState[] = []
  for (let i = 0; i < refs.length; i += CHUNK) {
    const filter = refs
      .slice(i, i + CHUNK)
      .map((ref) => `Ref_Key eq guid'${ref}'`)
      .join(' or ')
    out.push(
      ...(await client.all<OrderState>('Document_ЗаказыКлиента', {
        select: ['Ref_Key', 'СтатусЗаказа', 'Отгрузка'],
        filter,
      })),
    )
  }
  return out
}

/**
 * Statuses back from 1С (Д18): for every delivered request still open, its
 * order's status and shipment as the manager moves it. A status the cabinet
 * does not know yet (how 1С marks a refusal is still open) leaves it as it was.
 */
export async function refreshRequestStatuses(
  db: Db,
  fetchStates: (refs: string[]) => Promise<OrderState[]>,
): Promise<number> {
  const { rows } = await db.query<{ onec_ref: string }>(
    `select onec_ref from requests
     where delivery = 'delivered' and onec_ref is not null and status not in ('done', 'rejected')`,
  )
  if (!rows.length) return 0
  const states = await fetchStates(rows.map((r) => r.onec_ref))
  let changed = 0
  for (const s of states) {
    const status = requestStatusFrom1C(s.СтатусЗаказа)
    const shipment = s.Отгрузка === 'Отгружен' ? 'shipped' : 'not_shipped'
    const result = await db.query(
      // A close is stamped once, when the sync first sees it (the «заявка выполнена» notice).
      `update requests set status = coalesce($2, status), shipment_status = $3,
         closed_at = case when coalesce($2, status) in ('done', 'rejected')
                          then coalesce(closed_at, now()) end
       where onec_ref = $1 and (status is distinct from coalesce($2, status) or shipment_status <> $3)`,
      [s.Ref_Key, status, shipment],
    )
    changed += result.rowCount ?? 0
  }
  return changed
}
