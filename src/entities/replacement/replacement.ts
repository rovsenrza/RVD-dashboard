import { USAGE_UNIT_LABEL } from '@rvd/contracts'
import type { Replacement } from '@/entities/types'

/** Shared with the API's reports. */
export { USAGE_UNIT_LABEL }

/** Reasons for a swap (ТЗ, PRODUCT.md). 1С keeps the reference list; this mirrors it until sync. */
export const REPLACEMENT_REASONS = [
  'Плановая замена',
  'Гарантийная замена',
  'Поломка',
  'Износ',
  'Капитальный ремонт',
  'По требованию заказчика',
]

/** «2 241 м/ч», «15 300 км», or null when nothing was recorded. */
export function formatUsage(r: Pick<Replacement, 'operatingHours' | 'usageUnit'>): string | null {
  return r.operatingHours === null
    ? null
    : `${r.operatingHours.toLocaleString('ru-RU')} ${USAGE_UNIT_LABEL[r.usageUnit]}`
}
