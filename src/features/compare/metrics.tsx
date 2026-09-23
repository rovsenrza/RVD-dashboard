import type { ReactNode } from 'react'
import type { ModelStats } from '@/entities/types'
import { USAGE_UNIT_LABEL } from '@/entities/replacement'
import { formatNumber } from '@/shared/lib/utils'

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

/** One comparison row: how to read it and, where one exists, which direction is better. */
export interface Metric {
  label: string
  value: (m: ModelStats) => ReactNode
  /**
   * Score for picking the best model, at the precision the value is shown with — two models
   * that read «23 %» must tie. Absent when «better» is a matter of context.
   */
  score?: (m: ModelStats) => number | null
  better?: 'lower' | 'higher'
}

export const METRICS: Metric[] = [
  { label: 'Единиц техники', value: (m) => formatNumber(m.machines) },
  { label: 'РВД на технике', value: (m) => formatNumber(m.hoses) },
  {
    label: 'РВД на единицу',
    value: (m) => (m.machines ? (m.hoses / m.machines).toFixed(1).replace('.', ',') : '—'),
  },
  {
    label: 'Требуют замены',
    value: (m) => `${m.breakdown.replace} · ${pct(m.breakdown.replace, m.hoses)} %`,
    score: (m) => (m.hoses ? pct(m.breakdown.replace, m.hoses) : null),
    better: 'lower',
  },
  {
    label: 'Внимание',
    value: (m) => `${m.breakdown.warn} · ${pct(m.breakdown.warn, m.hoses)} %`,
  },
  { label: 'Замен за 12 месяцев', value: (m) => formatNumber(m.replacements12m) },
  {
    label: 'Замен на единицу за 12 месяцев',
    value: (m) => String(m.replacementsPerMachine).replace('.', ','),
    score: (m) => m.replacementsPerMachine,
    better: 'lower',
  },
  {
    label: 'Доля поломок среди замен',
    value: (m) => (m.replacements12m ? `${Math.round(m.failureShare * 100)} %` : '—'),
    score: (m) => (m.replacements12m ? Math.round(m.failureShare * 100) : null),
    better: 'lower',
  },
  {
    label: 'Средний срок службы до замены',
    value: (m) => (m.avgServiceDays === null ? '—' : `${formatNumber(m.avgServiceDays)} дн.`),
    score: (m) => m.avgServiceDays,
    better: 'higher',
  },
  {
    label: 'Средняя наработка при замене',
    value: (m) =>
      m.avgUsage ? `${formatNumber(m.avgUsage.value)} ${USAGE_UNIT_LABEL[m.avgUsage.unit]}` : '—',
  },
  { label: 'Чаще всего меняют', value: (m) => m.topPlace ?? '—' },
]

/** The model that does best on a metric, or null when there is no clear winner (a tie or no data). */
export function bestOf(metric: Metric, models: ModelStats[]): string | null {
  if (!metric.score || !metric.better || models.length < 2) return null
  const scored = models
    .map((m) => ({ model: m.model, s: metric.score!(m) }))
    .filter((x): x is { model: string; s: number } => x.s !== null)
  if (scored.length < 2) return null
  scored.sort((a, b) => (metric.better === 'lower' ? a.s - b.s : b.s - a.s))
  return scored[0].s === scored[1].s ? null : scored[0].model
}
