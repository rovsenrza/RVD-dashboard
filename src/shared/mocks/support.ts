import { formatISO } from 'date-fns'
import {
  SUPPORT_TOPIC_LABEL,
  supportChanges,
  supportProblem,
  type NewSupportMessage,
} from '@/entities/support'
import type { SupportMessage } from '@/entities/types'
import { products, record } from './data'

/** Messages to the supplier's specialist; the API keeps them and passes them on. */
export const supportMessages: SupportMessage[] = []

/** Takes a message for the specialist or names what is wrong with it, by the API's rule. */
export function sendSupportMessage(
  body: NewSupportMessage,
  now = new Date(),
): SupportMessage | { error: string } {
  const product = body.productId ? (products.find((p) => p.id === body.productId) ?? null) : null
  const problem = supportProblem(body, product, formatISO(now, { representation: 'date' }))
  if (problem) return { error: problem }

  const message: SupportMessage = {
    id: `m-${supportMessages.length + 1}`,
    createdAt: now.toISOString(),
    topic: body.topic,
    productId: product?.id ?? null,
    installedAt: body.topic === 'install_date' ? body.installedAt : null,
    text: (body.text ?? '').trim(),
  }
  supportMessages.unshift(message)
  record({
    action: 'support.message',
    target: product
      ? { kind: 'product', id: product.id, label: `EHS ${product.serialNumber}` }
      : { kind: 'message', id: message.id, label: SUPPORT_TOPIC_LABEL[message.topic] },
    changes: supportChanges(message, product?.installedAt ?? product?.shippedAt ?? null),
  })
  return message
}
