import type { Product, RequestKind, RequestPosition } from './types'

/** The customer's ceiling (2026-10-03): ten lines a request; a longer list goes as an Excel file. */
export const MAX_REQUEST_POSITIONS = 10

export const REQUEST_KINDS: readonly RequestKind[] = ['replace', 'manufacture', 'repair']

/** A spreadsheet the manager can read the positions from instead of the lines. */
export const isSpreadsheet = (fileName: string) => /\.xlsx?$/i.test(fileName.trim())

export interface RequestDraft {
  kind: RequestKind
  positions: RequestPosition[]
}

/**
 * What is wrong with a request, or null — the one check for the form, the
 * mocks and the BFF. «Замена» names hoses the company already has (made,
 * archive included), never a typed number. «Изготовление» and «Ремонт» take
 * numbers typed or picked, or no lines at all when an Excel file carries them;
 * a number missing from the catalogue goes as text for the manager to resolve.
 */
export function requestProblem(
  draft: RequestDraft,
  ctx: { productOf: (id: string) => Product | undefined; fileNames: string[] },
): string | null {
  if (!REQUEST_KINDS.includes(draft.kind)) return 'Неизвестный тип заявки'
  const lines = draft.positions
  if (lines.length > MAX_REQUEST_POSITIONS)
    return `В заявке не больше ${MAX_REQUEST_POSITIONS} позиций — остальные приложите таблицей Excel`

  if (draft.kind === 'replace') {
    if (lines.length === 0) return 'Выберите изделия, которые нужно заменить'
    const seen = new Set<string>()
    for (const line of lines) {
      const hose = line.productId ? ctx.productOf(line.productId) : undefined
      if (!hose) return 'В заявке на замену — только ваши изделия из реестра'
      if (hose.lifecycle === 'manufacturing')
        return `Изделие EHS ${hose.serialNumber} ещё изготавливается`
      if (seen.has(hose.id)) return `Изделие EHS ${hose.serialNumber} указано дважды`
      seen.add(hose.id)
    }
    return null
  }

  if (lines.length === 0 && !ctx.fileNames.some(isSpreadsheet))
    return 'Добавьте номера или приложите таблицу Excel'
  if (lines.some((l) => !l.catalogNumber?.trim())) return 'У позиции не указан каталожный номер'
  if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 99))
    return 'Количество — от 1 до 99'
  return null
}
