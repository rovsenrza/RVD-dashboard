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
 * never guess. Hoses first (EHS, internal number), then the catalogue (OEM)
 * number — many hoses share one, so it opens the hose only when it is the
 * sole one and otherwise the registry filtered by it — then machines
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
    products.find((p) => same(p.serialNumber)) ?? products.find((p) => same(p.clientNumber))
  if (hose) return { to: `/products/${hose.id}`, label: `EHS ${hose.serialNumber}` }

  const sharing = products.filter((p) => same(p.catalogNumber))
  if (sharing.length === 1)
    return { to: `/products/${sharing[0].id}`, label: `EHS ${sharing[0].serialNumber}` }
  if (sharing.length > 1 && sharing[0].catalogNumberId)
    return {
      to: `/products?catalog=${encodeURIComponent(sharing[0].catalogNumberId)}`,
      label: `Каталожный № (OEM) ${sharing[0].catalogNumber}`,
    }

  const machine = equipment.find((e) => same(e.garageNumber) || same(e.inventoryNumber))
  if (machine) return { to: `/equipment/${machine.id}`, label: machine.garageNumber }

  return null
}
