import type { Replacement } from '@/entities/types'

/** Reasons for a swap (ТЗ, PRODUCT.md). 1С keeps the reference list; this mirrors it until sync. */
export const REPLACEMENT_REASONS = [
  'Плановая замена',
  'Гарантийная замена',
  'Поломка',
  'Износ',
  'Капитальный ремонт',
  'По требованию заказчика',
]

export const USAGE_UNIT_LABEL: Record<Replacement['usageUnit'], string> = { hours: 'м/ч', km: 'км' }

/** «2 241 м/ч», «15 300 км», or null when nothing was recorded. */
export function formatUsage(r: Pick<Replacement, 'operatingHours' | 'usageUnit'>): string | null {
  return r.operatingHours === null
    ? null
    : `${r.operatingHours.toLocaleString('ru-RU')} ${USAGE_UNIT_LABEL[r.usageUnit]}`
}
