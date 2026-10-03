import type { RequestKind, RequestPosition, RequestStatus } from '@rvd/contracts'

/** What the cabinet sends 1С for one request — the structure of docs/1c/request-api.md. */
export interface OrderPayload {
  cabinetId: string
  client: string
  kind: RequestKind
  comment: string | null
  author: { name: string; email: string | null }
  lines: {
    product: string | null
    catalogNumber: string | null
    catalogNumberText: string | null
    equipment: string | null
    quantity: number
    comment: string | null
  }[]
  files: { name: string; url: string; size: number }[]
}

/** What 1С answers once the order exists. */
export interface OrderResult {
  ref: string
  number: string
  status: string
}

/** 1С looked at the request and said no; the message is for the client. */
export class OrderRefused extends Error {}

/** 1С could not be reached or failed; the request stays queued and is sent again. */
export class OrderUnavailable extends Error {}

export interface OrderService {
  create(payload: OrderPayload, idempotencyKey: string): Promise<OrderResult>
}

/** A stored request in the shape the payload is built from. */
export interface OutgoingRequest {
  id: string
  clientId: string
  kind: RequestKind
  comment: string | null
  author: { name: string; email: string | null }
  positions: RequestPosition[]
}

/**
 * Lines as 1С reads them: a hose by its Ref_Key; a catalogue number by its
 * Ref_Key, or as text when the catalogue does not know it (for a repair, the
 * work described). Files travel once the BFF stores them (Д25).
 */
export function toOrderPayload(r: OutgoingRequest): OrderPayload {
  return {
    cabinetId: r.id,
    client: r.clientId,
    kind: r.kind,
    comment: r.comment,
    author: r.author,
    lines: r.positions.map((p) => ({
      product: p.productId,
      catalogNumber: p.catalogNumberId,
      catalogNumberText: p.catalogNumberId ? null : p.catalogNumber,
      equipment: p.equipmentId,
      quantity: p.quantity,
      comment: null,
    })),
    files: [],
  }
}

/** «СтатусЗаказа» → the cabinet's request status; null for one it does not know yet (a refusal, say). */
export function requestStatusFrom1C(status: string | null | undefined): RequestStatus | null {
  switch ((status ?? '').trim()) {
    case 'Черновик':
    case 'КВыполнению':
    case 'НаСогласовании':
      return 'new'
    case 'ВРаботе':
      return 'in_progress'
    case 'Выполнен':
      return 'done'
    default:
      return null
  }
}

/** The 1С HTTP service, called with its own user; 1С's own words come back on a refusal. */
export interface HttpOrderOptions {
  url: string
  user?: string
  password?: string
  timeoutMs?: number
  fetch?: typeof fetch
}

export class HttpOrderService implements OrderService {
  private readonly opts: HttpOrderOptions

  constructor(opts: HttpOrderOptions) {
    this.opts = opts
  }

  async create(payload: OrderPayload, idempotencyKey: string): Promise<OrderResult> {
    const doFetch = this.opts.fetch ?? fetch
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotencyKey,
    }
    if (this.opts.user)
      headers.Authorization = `Basic ${Buffer.from(`${this.opts.user}:${this.opts.password ?? ''}`).toString('base64')}`
    let res: Response
    try {
      res = await doFetch(this.opts.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 30_000),
      })
    } catch (error) {
      throw new OrderUnavailable(`1С не отвечает: ${(error as Error).message}`)
    }
    // 1С may prefix the body with a byte-order mark.
    const text = (await res.text()).replace(/^﻿/, '')
    const body = text ? (JSON.parse(text) as Partial<OrderResult> & { error?: string }) : {}
    if (res.status === 200 || res.status === 201) {
      if (!body.ref || !body.number) throw new OrderUnavailable('1С ответила без номера заказа')
      return { ref: body.ref, number: body.number, status: body.status ?? '' }
    }
    if (res.status === 400 || res.status === 409 || res.status === 422)
      throw new OrderRefused(body.error || `1С отклонила заявку (${res.status})`)
    throw new OrderUnavailable(`1С ответила ${res.status}`)
  }
}
