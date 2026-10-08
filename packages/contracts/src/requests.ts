import type { Product, RequestKind, RequestPosition } from './types'

/** The customer's ceiling (2026-10-03): ten lines a request; a longer list goes as an Excel file. */
export const MAX_REQUEST_POSITIONS = 10

export const REQUEST_KINDS: readonly RequestKind[] = ['replace', 'manufacture', 'repair']

/** A spreadsheet the manager can read the positions from instead of the lines. */
export const isSpreadsheet = (fileName: string) => /\.xlsx?$/i.test(fileName.trim())

/**
 * Why a hose is replaced (ТЗ 3.5, PRODUCT.md). 1С keeps no reason for a swap, so the client
 * gives one in the replacement request (customer, 2026-10-08) and the journal shows it.
 */
export const REPLACEMENT_REASONS = [
  'Плановая замена',
  'Гарантийная замена',
  'Поломка',
  'Износ',
  'Капитальный ремонт',
  'По требованию заказчика',
]

/** Running hours or kilometres a client may give: whole, from nought to a machine's lifetime. */
export const MAX_OPERATING_HOURS = 1_000_000

/** What is wrong with a replacement line's reason and running hours, or null; both may be left out. */
function usageProblem(line: RequestPosition, serial: string): string | null {
  if (line.reason != null && !REPLACEMENT_REASONS.includes(line.reason))
    return `EHS ${serial}: выберите причину замены из списка`
  const hours = line.operatingHours
  if (hours != null && !(Number.isInteger(hours) && hours >= 0 && hours <= MAX_OPERATING_HOURS))
    return `EHS ${serial}: наработка — целое число от 0 до ${MAX_OPERATING_HOURS.toLocaleString('ru-RU')}`
  if (line.usageUnit != null && line.usageUnit !== 'hours' && line.usageUnit !== 'km')
    return `EHS ${serial}: наработка — в моточасах или километрах`
  return null
}

export interface RequestDraft {
  kind: RequestKind
  positions: RequestPosition[]
}

/**
 * What is wrong with a request, or null — the one check for the form, the
 * mocks and the BFF.
 * - «Замена» names hoses the company already has (made, archive included),
 *   never a typed number.
 * - «Ремонт» may name the company's hoses in service — when it is ours being
 *   repaired, 1С records the repair in its status history — and may describe
 *   any other work in text (the 1С developer, 2026-10-03: a repair is a service
 *   and materials, a hose is optional).
 * - «Изготовление» takes catalogue numbers typed or picked; a number missing
 *   from the catalogue goes as text for the manager to resolve.
 * The last two may come with no lines at all when an Excel file carries them.
 */
export function requestProblem(
  draft: RequestDraft,
  ctx: { productOf: (id: string) => Product | undefined; fileNames: string[] },
): string | null {
  if (!REQUEST_KINDS.includes(draft.kind)) return 'Неизвестный тип заявки'
  const lines = draft.positions
  if (lines.length > MAX_REQUEST_POSITIONS)
    return `В заявке не больше ${MAX_REQUEST_POSITIONS} позиций — остальные приложите таблицей Excel`

  const hoseLines = lines.filter((l) => l.productId)
  const textLines = lines.filter((l) => !l.productId)

  if (draft.kind === 'replace') {
    if (lines.length === 0) return 'Выберите изделия, которые нужно заменить'
    if (textLines.length) return 'В заявке на замену — только ваши изделия из реестра'
  }
  if (draft.kind === 'manufacture' && hoseLines.length)
    return 'В заявке на изготовление — номера, а не изделия: чтобы заменить изделие, выберите «Замена»'

  const seen = new Set<string>()
  for (const line of hoseLines) {
    const hose = ctx.productOf(line.productId!)
    if (!hose)
      return `В заявке на ${draft.kind === 'repair' ? 'ремонт' : 'замену'} — только ваши изделия из реестра`
    if (hose.lifecycle === 'manufacturing')
      return `Изделие EHS ${hose.serialNumber} ещё изготавливается`
    if (draft.kind === 'repair' && hose.lifecycle === 'written_off')
      return `Изделие EHS ${hose.serialNumber} списано — в ремонт его не отправить`
    if (seen.has(hose.id)) return `Изделие EHS ${hose.serialNumber} указано дважды`
    seen.add(hose.id)
    const usage = draft.kind === 'replace' ? usageProblem(line, hose.serialNumber) : null
    if (usage) return usage
  }
  if (draft.kind === 'replace') return null

  if (lines.length === 0 && !ctx.fileNames.some(isSpreadsheet))
    return draft.kind === 'repair'
      ? 'Выберите изделия, опишите работу или приложите таблицу Excel'
      : 'Добавьте номера или приложите таблицу Excel'
  if (textLines.some((l) => !l.catalogNumber?.trim()))
    return draft.kind === 'repair'
      ? 'Опишите, что отремонтировать'
      : 'У позиции не указан каталожный номер'
  if (textLines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 99))
    return 'Количество — от 1 до 99'
  return null
}
