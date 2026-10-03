import type { Equipment, Product } from '@/entities/types'

/** «EHS 48703 · 07098-010A9 · НТ08» — how a hose reads in a picker; also its suggestion value. */
export function productLabel(p: Product, equipment: Equipment[] | undefined): string {
  const where =
    p.lifecycle === 'written_off'
      ? 'списано'
      : (equipment?.find((e) => e.id === p.equipmentId)?.garageNumber ?? 'на складе')
  return [`EHS ${p.serialNumber}`, p.catalogNumber ?? 'без каталожного №', where].join(' · ')
}

const code = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/^(ehs|esm)[\s:№#-]*/, '')

/**
 * The hose a typed value names: a suggestion taken whole, or an exact EHS or
 * internal number. Never a partial match — a picker must not guess.
 */
export function findProduct(
  products: Product[],
  typed: string,
  labelOf: (p: Product) => string,
): Product | undefined {
  const whole = typed.trim().toLowerCase()
  if (!whole) return undefined
  return (
    products.find((p) => labelOf(p).toLowerCase() === whole) ??
    products.find((p) => p.serialNumber.toLowerCase() === code(typed)) ??
    products.find((p) => p.clientNumber?.trim().toLowerCase() === whole)
  )
}
