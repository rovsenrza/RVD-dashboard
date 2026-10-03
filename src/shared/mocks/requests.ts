import { REQUEST_KIND_LABEL } from '@/entities/request'
import { requestProblem } from '@/entities/request/rules'
import type { Product, RequestPosition, ServiceRequest } from '@/entities/types'
import { LIVE } from '@/shared/api/live'
import type { NewRequest } from '@/shared/api/queries'
import { claimAttachments, storedFile } from './attachments'
import { filesChange, products, record, requests } from './data'

/**
 * Hybrid mode: the hoses come from the BFF, which does not take requests yet,
 * so the mock cannot look them up — it takes a replacement line as the form
 * sent it.
 */
const asSent = (line: RequestPosition | undefined): Product | undefined =>
  line?.productId
    ? ({
        id: line.productId,
        serialNumber: line.productId,
        lifecycle: 'in_operation',
        catalogNumberId: line.catalogNumberId,
        catalogNumber: line.catalogNumber,
        equipmentId: line.equipmentId,
      } as Product)
    : undefined

/**
 * Takes a request the way the BFF will: checked by the shared rule, a
 * replacement's lines rebuilt from the hoses themselves (number, machine) so
 * the client cannot send them out of step, then the drafts bound to it.
 */
export function createRequest(raw: NewRequest): ServiceRequest | { error: string } {
  // What arrives over the wire is not trusted to have every field.
  const body: NewRequest = { ...raw, positions: Array.isArray(raw.positions) ? raw.positions : [] }
  const drafts = (body.attachmentIds ?? []).flatMap((id) => {
    const s = storedFile(id)
    return s && !s.owner ? [s.meta] : []
  })
  const productOf = (id: string) =>
    products.find((p) => p.id === id) ??
    (LIVE ? asSent(body.positions.find((l) => l.productId === id)) : undefined)
  const problem = requestProblem(body, { productOf, fileNames: drafts.map((f) => f.fileName) })
  if (problem) return { error: problem }

  // A line naming a hose (every «Замена» line, a «Ремонт» line for our hose) takes its
  // number and machine from the hose, never from the client's copy.
  const positions = body.positions.map((line) => {
    if (!line.productId) return { ...line, productId: null }
    const hose = productOf(line.productId)!
    return {
      productId: hose.id,
      catalogNumberId: hose.catalogNumberId,
      catalogNumber: hose.catalogNumber,
      equipmentId: hose.equipmentId,
      quantity: 1,
    }
  })
  const id = `req-${requests.length + 1}`
  const created: ServiceRequest = {
    id,
    number: `СВЦБ-${String(5200 + requests.length).padStart(5, '0')}`,
    branchId: body.branchId,
    productId: positions.length === 1 ? positions[0].productId : null,
    kind: body.kind,
    positions,
    quantity: positions.reduce((sum, l) => sum + l.quantity, 0),
    comment: body.comment?.trim() || null,
    status: 'new',
    shipmentStatus: 'not_shipped',
    createdAt: new Date().toISOString().slice(0, 10),
    attachments: claimAttachments(body.attachmentIds, { kind: 'request', id }),
    delivery: 'delivered',
    deliveryNote: null,
  }
  requests.unshift(created)

  const hoses = positions.flatMap((l) => {
    const hose = l.productId ? productOf(l.productId) : undefined
    return hose ? [`EHS ${hose.serialNumber}`] : []
  })
  record({
    action: 'request.create',
    target: { kind: 'request', id: created.id, label: created.number ?? created.id },
    changes: [
      { field: 'Тип', before: null, after: REQUEST_KIND_LABEL[created.kind] },
      ...(hoses.length ? [{ field: 'Изделия', before: null, after: hoses.join(', ') }] : []),
      { field: 'Количество', before: null, after: String(created.quantity) },
      ...filesChange(created.attachments),
    ],
  })
  return created
}
