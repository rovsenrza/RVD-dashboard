import {
  lifetimePhases,
  serviceDates,
  type Product,
  type ProductLifetime,
  type StatusRules,
} from '@rvd/contracts'

/**
 * The service-life timeline of one item, from the same rule as its status.
 * `endedAt` stays null until the write-off date is known from 1С.
 */
export function productLifetime(p: Product, rules: StatusRules): ProductLifetime | null {
  const d = serviceDates(p, rules)
  if (!d) return null
  return {
    startedAt: d.start,
    basis: d.basis,
    endedAt: null,
    warrantyUntil: d.warrantyUntil,
    plannedAt: d.plannedAt,
    phases: lifetimePhases(d),
  }
}
