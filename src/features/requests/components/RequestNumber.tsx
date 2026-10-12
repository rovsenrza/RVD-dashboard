import type { ServiceRequest } from '@/entities/types'
import { Tooltip } from '@/shared/ui'

/**
 * The 1С number once the order exists; until then where the request stands —
 * on its way (the cabinet keeps sending), with the manager, or refused, with the reason.
 */
export function RequestNumber({ request: r }: { request: ServiceRequest }) {
  if (r.number) return <span className="font-medium text-brand-deep">{r.number}</span>
  // Requests go to the manager by mail (customer, 2026-10-12); the order made from the letter
  // shows in «Заявки» on its own as «Заказ в 1С».
  const label =
    r.delivery === 'refused' ? (
      <span className="font-medium text-status-replace-ink">Не принята</span>
    ) : r.delivery === 'delivered' ? (
      <span className="text-ink-secondary">Отправлена менеджеру</span>
    ) : (
      <span className="text-ink-muted">Отправляется</span>
    )
  return r.deliveryNote ? (
    <Tooltip content={r.deliveryNote}>
      <span tabIndex={0}>{label}</span>
    </Tooltip>
  ) : (
    label
  )
}
