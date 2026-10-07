import { addDays, format, formatISO, parseISO, subDays } from 'date-fns'
import type { ProductStatus, ReportColumn, ReportValue } from '@/entities/types'
import { STATUS_LABEL } from '@/entities/product'

/** The report list lives in @rvd/contracts, shared with the API that builds them. */
export { buildReport, REPORTS, reportMeta, type ReportMeta } from '@rvd/contracts'

export type PeriodPreset = '30' | '90' | '365' | 'custom'

/** Short enough for four segments on a phone; the dates under the control say which way. */
export const PRESET_LABEL: Record<PeriodPreset, string> = {
  '30': '30 дней',
  '90': 'Квартал',
  '365': 'Год',
  custom: 'Свои даты',
}

const day = (d: Date) => formatISO(d, { representation: 'date' })

/** A preset period as ISO dates, ending today (past) or starting today (future). */
export function presetPeriod(
  preset: Exclude<PeriodPreset, 'custom'>,
  dir: 'past' | 'future',
  today = new Date(),
) {
  const n = Number(preset)
  return dir === 'past'
    ? { from: day(subDays(today, n)), to: day(today) }
    : { from: day(today), to: day(addDays(today, n)) }
}

/** A value as people read it in the preview and on paper; null when there is nothing to show. */
export function reportText(column: ReportColumn, value: ReportValue): string | null {
  if (value === null || value === '') return null
  switch (column.type) {
    case 'date':
      return format(parseISO(String(value)), 'dd.MM.yyyy')
    case 'number':
      return typeof value === 'number' ? value.toLocaleString('ru-RU') : String(value)
    case 'status':
      return STATUS_LABEL[value as ProductStatus] ?? String(value)
    default:
      return String(value)
  }
}

/** «01.09.2026 — 30.09.2026» */
export const periodText = (p: { from: string; to: string }) =>
  `${format(parseISO(p.from), 'dd.MM.yyyy')} — ${format(parseISO(p.to), 'dd.MM.yyyy')}`

/** «реестр-рвд-2026-09-24» — a file name that sorts by date in a downloads folder. */
export const reportFileName = (title: string, generatedAt: string) =>
  `${title.toLowerCase().replace(/\s+/g, '-')}-${generatedAt.slice(0, 10)}`
