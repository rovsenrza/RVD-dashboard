import type { Equipment, Product } from '@/entities/types'

export interface CodeMatch {
  to: string
  label: string
}

/**
 * What a scanned or typed code most likely names. Hose labels are not
 * specified yet (ЕГС marking is pending), so accept the plain number, a
 * number with an «EHS»/«ESM» prefix, or a URL whose `ehs`/`serial` parameter
 * or last path segment carries it.
 */
export function normaliseCode(raw: string): string {
  let code = raw.trim()
  if (/^https?:\/\//i.test(code)) {
    try {
      const url = new URL(code)
      code =
        url.searchParams.get('ehs') ??
        url.searchParams.get('serial') ??
        url.pathname.split('/').filter(Boolean).pop() ??
        ''
    } catch {
      // Not a real URL after all: match the text as it is.
    }
  }
  return code
    .replace(/^(ehs|esm)[\s:№#-]*/i, '')
    .trim()
    .toLowerCase()
}

/**
 * Exact match only: a scan must open one object or say it found nothing,
 * never guess. Hoses first (EHS, internal, OEM number), then machines
 * (garage, inventory number).
 */
export function matchCode(
  raw: string,
  products: Product[],
  equipment: Equipment[],
): CodeMatch | null {
  const code = normaliseCode(raw)
  if (!code) return null
  const same = (v: string | null | undefined) => v?.trim().toLowerCase() === code

  const hose =
    products.find((p) => same(p.serialNumber)) ??
    products.find((p) => same(p.clientNumber)) ??
    products.find((p) => same(p.oemNumber))
  if (hose) return { to: `/products/${hose.id}`, label: `EHS ${hose.serialNumber}` }

  const machine = equipment.find((e) => same(e.garageNumber) || same(e.inventoryNumber))
  if (machine) return { to: `/equipment/${machine.id}`, label: machine.garageNumber }

  return null
}
