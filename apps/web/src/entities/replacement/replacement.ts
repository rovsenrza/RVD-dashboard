import { USAGE_UNIT_LABEL } from '@rvd/contracts'
import type { Replacement } from '@/entities/types'

/** Shared with the API's reports. */
export { USAGE_UNIT_LABEL }

/** Reasons for a swap: the client gives one in the replacement request; shared with the API. */
export { REPLACEMENT_REASONS } from '@rvd/contracts'

/** «2 241 м/ч», «15 300 км», or null when nothing was recorded. */
export function formatUsage(r: Pick<Replacement, 'operatingHours' | 'usageUnit'>): string | null {
  return r.operatingHours === null
    ? null
    : `${r.operatingHours.toLocaleString('ru-RU')} ${USAGE_UNIT_LABEL[r.usageUnit]}`
}
