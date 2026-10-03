import type { ServiceRequest } from '@/entities/types'
import { Tooltip } from '@/shared/ui'

/**
 * The 1С number once the order exists; until then where the request stands —
 * on its way (the cabinet keeps sending) or refused by 1С, with the reason.
 */
export function RequestNumber({ request: r }: { request: ServiceRequest }) {
  if (r.number) return <span className="font-medium text-brand-deep">{r.number}</span>
  const label =
    r.delivery === 'refused' ? (
      <span className="font-medium text-status-replace-ink">Не принята 1С</span>
    ) : (
      <span className="text-ink-muted">Отправляется в 1С</span>
    )
  return r.deliveryNote ? (
    <Tooltip content={r.deliveryNote}>
      <span tabIndex={0}>{label}</span>
    </Tooltip>
  ) : (
    label
  )
}
