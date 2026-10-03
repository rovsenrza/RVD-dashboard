import { format, formatISO, parseISO } from 'date-fns'
import { SUPPORT_TOPIC_LABEL } from '@/entities/support'
import type { AuditChange, SupportMessage } from '@/entities/types'
import type { NewSupportMessage } from '@/shared/api/queries'
import { products, record } from './data'

/** Messages to the supplier's specialist; the BFF will pass them on (mail or 1С — open with the customer). */
export const supportMessages: SupportMessage[] = []

const day = (isoDate: string) => format(parseISO(isoDate), 'dd.MM.yyyy')
const MAX_TEXT = 2000

/**
 * Takes a message for the specialist or names what is wrong with it, as the
 * BFF will. A date correction must name the hose and a date that can be true:
 * not ahead of today, not before the hose was shipped.
 */
export function sendSupportMessage(
  body: NewSupportMessage,
  now = new Date(),
): SupportMessage | { error: string } {
  if (!Object.hasOwn(SUPPORT_TOPIC_LABEL, body.topic))
    return { error: 'Неизвестная тема обращения' }
  const product = body.productId ? products.find((p) => p.id === body.productId) : undefined
  if (body.productId && !product) return { error: 'Изделие не найдено' }
  const text = (body.text ?? '').trim()
  if (text.length > MAX_TEXT) return { error: `Сообщение длиннее ${MAX_TEXT} знаков` }

  let installedAt: string | null = null
  if (body.topic === 'install_date') {
    if (!product) return { error: 'Укажите изделие, у которого неверная дата установки' }
    installedAt = body.installedAt
    if (!installedAt || !/^\d{4}-\d{2}-\d{2}$/.test(installedAt))
      return { error: 'Укажите, какая дата установки верная' }
    if (installedAt > formatISO(now, { representation: 'date' }))
      return { error: 'Дата установки не может быть в будущем' }
    if (product.shippedAt && installedAt < product.shippedAt)
      return { error: `Изделие отгружено ${day(product.shippedAt)}, раньше его не установить` }
  } else if (!text) return { error: 'Напишите, что нужно специалисту' }

  const message: SupportMessage = {
    id: `m-${supportMessages.length + 1}`,
    createdAt: now.toISOString(),
    topic: body.topic,
    productId: product?.id ?? null,
    installedAt,
    text,
  }
  supportMessages.unshift(message)

  const current = product?.installedAt ?? product?.shippedAt ?? null
  const changes: AuditChange[] = [
    { field: 'Тема', before: null, after: SUPPORT_TOPIC_LABEL[message.topic] },
    ...(installedAt
      ? [{ field: 'Дата установки', before: current && day(current), after: day(installedAt) }]
      : []),
    ...(text ? [{ field: 'Сообщение', before: null, after: text }] : []),
  ]
  record({
    action: 'support.message',
    target: product
      ? { kind: 'product', id: product.id, label: `EHS ${product.serialNumber}` }
      : { kind: 'message', id: message.id, label: SUPPORT_TOPIC_LABEL[message.topic] },
    changes,
  })
  return message
}
