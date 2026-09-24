import { addDays, format, formatISO, parseISO, subDays } from 'date-fns'
import type { ProductStatus, ReportColumn, ReportId, ReportValue } from '@/entities/types'
import { STATUS_LABEL } from '@/entities/product'

export interface ReportMeta {
  id: ReportId
  title: string
  description: string
  /** Which way the period runs from today; null — a report «на сегодня» without a period. */
  period: 'past' | 'future' | null
}

/** ТЗ §4, in the order a manager works through them: state now, what is coming, what happened. */
export const REPORTS: ReportMeta[] = [
  {
    id: 'registry',
    title: 'Реестр РВД',
    description: 'Все изделия филиала — на технике и на складе — с состоянием и сроками.',
    period: null,
  },
  {
    id: 'warranty',
    title: 'На гарантии',
    description:
      'Установленные изделия с действующей гарантией: до какого числа и сколько дней осталось.',
    period: null,
  },
  {
    id: 'due',
    title: 'Требуют замены',
    description: 'Изделия, выработавшие срок эксплуатации, — на сколько дней просрочена замена.',
    period: null,
  },
  {
    id: 'plan',
    title: 'План замен',
    description:
      'Что заменить до конца периода: срок эксплуатации истекает в периоде или уже истёк. Основа для заявки.',
    period: 'future',
  },
  {
    id: 'replacements',
    title: 'История замен',
    description: 'Замены за период: что сняли, что поставили, причина и наработка.',
    period: 'past',
  },
  {
    id: 'equipment',
    title: 'Статистика по технике',
    description: 'По каждой машине: сколько РВД, в каком они состоянии и сколько замен за период.',
    period: 'past',
  },
  {
    id: 'branches',
    title: 'Статистика по филиалам',
    description: 'По филиалам: техника, РВД, состояние, замены и заявки за период.',
    period: 'past',
  },
]

export const reportMeta = (id: string | null) => REPORTS.find((r) => r.id === id) ?? null

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
