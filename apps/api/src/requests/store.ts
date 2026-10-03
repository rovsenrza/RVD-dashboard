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
   * Names of the attached files, for the «Excel instead of lines» rule until the
   * BFF stores files itself (Д25) and can read them.
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
    branchId: r.branch_id,
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
 * and the request joins the queue for 1С. The client is the cabinet's 1С
 * client; without one configured, the hoses' own client — one per request.
 */
export async function createRequest(
  db: Db,
  input: RequestInput,
  ctx: { clientKey?: string; actor: Actor },
): Promise<ServiceRequest> {
  const positions = Array.isArray(input.positions) ? input.positions : []
  const ids = [...new Set(positions.flatMap((l) => (l.productId ? [l.productId] : [])))]
  const { rows: found } = await db.query<{ product: Product; client_id: string }>(
    `select data as product, client_id from products where id = any($1)`,
    [ids],
  )
  const owners = new Set(found.map((r) => r.client_id))
  const clientId = ctx.clientKey ?? (owners.size === 1 ? [...owners][0] : undefined)
  if (!clientId)
    throw new RequestRejected(
      owners.size > 1
        ? 'В одной заявке — изделия одного клиента'
        : 'Кабинет не привязан к клиенту 1С: выберите изделия или задайте CABINET_CLIENT_KEY',
    )
  // Only the client's own hoses count as «yours»; anyone else's is as unknown as a typo.
  const hoses = new Map(
    found.filter((r) => r.client_id === clientId).map((r) => [r.product.id, r.product]),
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
      input.branchId ?? '',
      input.kind,
      JSON.stringify(lines),
      input.comment?.trim() || null,
      JSON.stringify(input.attachmentIds ?? []),
      JSON.stringify(ctx.actor),
    ],
  )
  return toServiceRequest(rows[0])
}

/** The client's requests, newest first; all of them when no client is configured (the demo). */
export async function listRequests(db: Db, clientKey?: string): Promise<ServiceRequest[]> {
  const { rows } = await db.query<RequestRow>(
    `select * from requests where ($1::text is null or client_id = $1) order by created_at desc, id`,
    [clientKey ?? null],
  )
  return rows.map(toServiceRequest)
}
