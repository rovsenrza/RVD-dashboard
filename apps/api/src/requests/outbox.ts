import type { Db } from '../db/pool.ts'
import {
  OrderRefused,
  requestStatusFrom1C,
  toOrderPayload,
  type OrderService,
} from '../onec/orders.ts'
import type { RequestRow } from './store.ts'

/** Minutes until the next try after the n-th failed one: soon at first, then every few hours. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360]
export const nextAttemptAt = (now: Date, failures: number) =>
  new Date(now.getTime() + BACKOFF_MINUTES[Math.min(failures, BACKOFF_MINUTES.length) - 1] * 60_000)

export interface DeliveryRound {
  delivered: number
  refused: number
  postponed: number
}

/**
 * Sends the requests that are due to 1С (Д17). Delivered — the order's ref,
 * number and status are kept; refused — 1С's reason goes to the client;
 * 1С unreachable — tried again later, with growing pauses. Rows are locked
 * while they are sent, so two senders never send one request twice.
 */
export async function deliverDue(
  db: Db,
  orders: OrderService,
  now = new Date(),
  limit = 20,
): Promise<DeliveryRound> {
  const round: DeliveryRound = { delivered: 0, refused: 0, postponed: 0 }
  const client = await db.connect()
  try {
    await client.query('begin')
    const { rows } = await client.query<RequestRow>(
      `select * from requests where delivery = 'queued' and next_attempt_at <= $1
       order by created_at limit $2 for update skip locked`,
      [now, limit],
    )
    for (const r of rows) {
      try {
        const order = await orders.create(
          toOrderPayload({
            id: r.id,
            clientId: r.client_id,
            kind: r.kind,
            comment: r.comment,
            author: r.author,
            positions: r.positions,
          }),
          r.id,
        )
        await client.query(
          `update requests set delivery = 'delivered', onec_ref = $2, number = $3, status = $4,
             attempts = attempts + 1, last_error = null where id = $1`,
          [r.id, order.ref, order.number, requestStatusFrom1C(order.status) ?? 'new'],
        )
        round.delivered++
      } catch (error) {
        const message = (error as Error).message
        if (error instanceof OrderRefused) {
          await client.query(
            `update requests set delivery = 'refused', status = 'rejected',
               attempts = attempts + 1, last_error = $2 where id = $1`,
            [r.id, message],
          )
          round.refused++
        } else {
          await client.query(
            `update requests set attempts = attempts + 1, last_error = $2, next_attempt_at = $3
             where id = $1`,
            [r.id, message, nextAttemptAt(now, r.attempts + 1)],
          )
          round.postponed++
        }
      }
    }
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
  return round
}

/** Sends the queue now and then every `intervalMs`; `kick` sends at once (after a new request). */
export function startOutbox(
  db: Db,
  orders: OrderService,
  intervalMs: number,
  log: (error: unknown) => void,
): { kick: () => void; stop: () => void } {
  let running = false
  const tick = () => {
    if (running) return
    running = true
    deliverDue(db, orders)
      .catch(log)
      .finally(() => {
        running = false
      })
  }
  const timer = setInterval(tick, intervalMs)
  tick()
  return { kick: tick, stop: () => clearInterval(timer) }
}
