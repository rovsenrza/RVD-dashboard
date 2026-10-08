import { randomUUID } from 'node:crypto'
import {
  requestProblem,
  type Product,
  type RequestDelivery,
  type RequestKind,
  type RequestPosition,
  type RequestStatus,
  type ServiceRequest,
  type ShipmentStatus,
} from '@rvd/contracts'
import type { Db } from '../db/pool.ts'

/** What the form sends (the contract's NewRequest); the server decides everything else. */
export interface RequestInput {
  branchId: string
  kind: RequestKind
  positions: RequestPosition[]
  comment: string | null
  attachmentIds?: string[]
  /**
   * Names of the attached files, for the «Excel instead of lines» rule: the route
   * fills them from the drafts the server holds (Д25), never from the browser.
   */
  attachmentNames?: string[]
}

export interface Actor {
  name: string
  email: string | null
}

export interface RequestRow {
  id: string
  client_id: string
  branch_id: string
  kind: RequestKind
  positions: RequestPosition[]
  comment: string | null
  attachment_ids: string[]
  author: Actor
  created_at: Date
  delivery: RequestDelivery
  attempts: number
  next_attempt_at: Date
  last_error: string | null
  onec_ref: string | null
  number: string | null
  status: RequestStatus
  shipment_status: ShipmentStatus
}

export class RequestRejected extends Error {}

/** A stored request as the cabinet shows it; files join it once the BFF stores them (Д25). */
export function toServiceRequest(r: RequestRow): ServiceRequest {
  return {
    id: r.id,
    number: r.number,
    // A branch is one of the company's 1С clients, and a request is one client's order.
    branchId: r.client_id,
    productId: r.positions.length === 1 ? r.positions[0].productId : null,
    kind: r.kind,
    positions: r.positions,
    quantity: r.positions.reduce((sum, p) => sum + p.quantity, 0),
    comment: r.comment,
    status: r.status,
    shipmentStatus: r.shipment_status,
    createdAt: r.created_at.toISOString().slice(0, 10),
    attachments: [],
    delivery: r.delivery,
    deliveryNote:
      r.delivery === 'refused'
        ? r.last_error
        : r.delivery === 'queued' && r.attempts > 0
          ? 'Нет связи с 1С — отправим автоматически'
          : null,
  }
}

/**
 * Takes a request the way the mock does, against the cache: the shared rule
 * checks it, a hose line is rebuilt from the hose itself (number, machine),
 * and the request joins the queue for 1С. A request is one 1С client's order —
 * one branch's: its hoses' branch, else the branch the form names, else the
 * person's only one. `clients` are the person's branches; without sign-in
 * (undefined) any client's hoses count.
 */
export async function createRequest(
  db: Db,
  input: RequestInput,
  ctx: { clients?: string[]; actor: Actor },
): Promise<ServiceRequest> {
  const positions = Array.isArray(input.positions) ? input.positions : []
  const ids = [...new Set(positions.flatMap((l) => (l.productId ? [l.productId] : [])))]
  const { rows: found } = await db.query<{ product: Product; client_id: string }>(
    `select data as product, client_id from products where id = any($1)`,
    [ids],
  )
  // Only the person's hoses count as «yours»; anyone else's is as unknown as a typo.
  const own = found.filter((r) => !ctx.clients || ctx.clients.includes(r.client_id))
  const owners = new Set(own.map((r) => r.client_id))
  if (owners.size > 1)
    throw new RequestRejected(
      'В одной заявке — изделия одного филиала: оформите по заявке на каждый',
    )
  const named = input.branchId && ctx.clients?.includes(input.branchId) ? input.branchId : undefined
  const clientId =
    [...owners][0] ?? named ?? (ctx.clients?.length === 1 ? ctx.clients[0] : undefined)
  if (!clientId)
    throw new RequestRejected(
      ctx.clients
        ? 'Выберите филиал, для которого заявка'
        : 'Кабинет не привязан к клиенту 1С: выберите изделия или задайте CABINET_CLIENT_KEY',
    )
  const hoses = new Map(
    own.filter((r) => r.client_id === clientId).map((r) => [r.product.id, r.product]),
  )
  const problem = requestProblem(
    { kind: input.kind, positions },
    { productOf: (id) => hoses.get(id), fileNames: input.attachmentNames ?? [] },
  )
  if (problem) throw new RequestRejected(problem)

  const lines: RequestPosition[] = positions.map((line) => {
    if (!line.productId) return { ...line, productId: null }
    const hose = hoses.get(line.productId)!
    return {
      productId: hose.id,
      catalogNumberId: hose.catalogNumberId,
      catalogNumber: hose.catalogNumber,
      equipmentId: hose.equipmentId,
      quantity: 1,
    }
  })
  const { rows } = await db.query<RequestRow>(
    `insert into requests (id, client_id, branch_id, kind, positions, comment, attachment_ids, author)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [
      randomUUID(),
      clientId,
      clientId,
      input.kind,
      JSON.stringify(lines),
      input.comment?.trim() || null,
      JSON.stringify(input.attachmentIds ?? []),
      JSON.stringify(ctx.actor),
    ],
  )
  return toServiceRequest(rows[0])
}

/** The clients' requests, newest first; all of them when no client is configured (the demo). */
export async function listRequests(db: Db, clients?: string[]): Promise<ServiceRequest[]> {
  const { rows } = await db.query<RequestRow>(
    `select * from requests where ($1::text[] is null or client_id = any($1))
     order by created_at desc, id`,
    [clients ?? null],
  )
  return rows.map(toServiceRequest)
}
