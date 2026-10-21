import { differenceInCalendarDays, parseISO } from 'date-fns'
import type {
  Equipment,
  ModelComparison,
  ModelStats,
  Product,
  ProductStatus,
  Replacement,
} from './types'

/** The swap reasons that count as a failure: a breakdown, and the warranty causes. */
const FAILURES = new Set(['Поломка', 'Ошибка в обжимке', 'Заводской брак'])

const mostCommon = (values: (string | null)[]) => {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** The day a hose counts from in a period: when it was made, else shipped. */
const madeOn = (p: Product) => p.manufacturedAt ?? p.shippedAt

/**
 * The period asked for, the missing ends filled in: from the first of the given
 * hoses made (customer, 2026-10-16), else a year back, to today.
 */
export function comparisonPeriod(
  products: Product[],
  today: string,
  asked: { from?: string | null; to?: string | null } = {},
): ModelComparison['period'] {
  const first = products
    .map(madeOn)
    .filter((d): d is string => !!d)
    .sort()[0]
  const yearAgo = new Date(parseISO(today).getTime() - 365 * 86_400_000).toISOString().slice(0, 10)
  return { from: asked.from || first || yearAgo, to: asked.to || today }
}

/**
 * Machine models side by side (Д15), for the mock and the API alike, over a
 * period: the hoses on each model's machines that were made in it, as they stand
 * today, and the replacements done in it. A hose with no date at all is counted
 * in any period. `by: 'machine'` compares single machines instead (customer,
 * 2026-10-11: pick units by brand, model and garage №).
 */
export function modelStats(
  data: { equipment: Equipment[]; products: Product[]; replacements: Replacement[] },
  period: ModelComparison['period'],
  by: 'model' | 'machine' = 'model',
): ModelStats[] {
  const within = (d: string) => d >= period.from && d <= period.to
  const product = new Map(data.products.map((p) => [p.id, p]))
  const onMachine = new Map<string, Product[]>()
  for (const p of data.products) {
    const made = madeOn(p)
    if (!p.equipmentId || p.lifecycle === 'written_off' || (made && !within(made))) continue
    onMachine.set(p.equipmentId, [...(onMachine.get(p.equipmentId) ?? []), p])
  }
  const groups = new Map<string, Equipment[]>()
  const nameOf = (e: Equipment) =>
    [e.brand, e.model].filter(Boolean).join(' ') || e.type || 'Без марки'
  for (const e of data.equipment) {
    const key = by === 'machine' ? e.id : nameOf(e)
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  return [...groups]
    .map(([key, machines]): ModelStats => {
      const ids = new Set<string | null>(machines.map((m) => m.id))
      const breakdown: Record<ProductStatus, number> = {
        ok: 0,
        warn: 0,
        replace: 0,
        no_warranty: 0,
      }
      const hoses = machines.flatMap((m) => onMachine.get(m.id) ?? [])
      for (const p of hoses) breakdown[p.status]++
      const swaps = data.replacements.filter((r) => ids.has(r.equipmentId) && within(r.date))
      const olds = swaps.map((r) => product.get(r.oldProductId))
      // How long the hose taken off had served: from its start (installation, else shipment).
      const served = swaps
        .map((r, i) => {
          const start = olds[i]?.installedAt ?? olds[i]?.shippedAt
          return start ? differenceInCalendarDays(parseISO(r.date), parseISO(start)) : -1
        })
        .filter((d) => d > 0)
      const unit: 'hours' | 'km' = machines[0].type === 'Самосвал' ? 'km' : 'hours'
      const usage = swaps.filter((r) => r.operatingHours !== null && r.usageUnit === unit)
      const reasoned = swaps.filter((r) => r.reason !== null)
      return {
        id: key,
        model: nameOf(machines[0]),
        garageNumber: by === 'machine' ? machines[0].garageNumber : null,
        type: machines[0].type,
        machines: machines.length,
        hoses: hoses.length,
        breakdown,
        replacements: swaps.length,
        replacementsPerMachine: round1(swaps.length / machines.length),
        failureShare: reasoned.length
          ? reasoned.filter((r) => r.reason !== null && FAILURES.has(r.reason)).length /
            reasoned.length
          : null,
        avgServiceDays: served.length
          ? Math.round(served.reduce((a, b) => a + b, 0) / served.length)
          : null,
        avgUsage: usage.length
          ? {
              value: Math.round(usage.reduce((a, r) => a + r.operatingHours!, 0) / usage.length),
              unit,
            }
          : null,
        topPlace: mostCommon(olds.map((p) => p?.installPlace ?? null)),
      }
    })
    .sort(
      (a, b) =>
        b.machines - a.machines ||
        a.model.localeCompare(b.model) ||
        (a.garageNumber ?? '').localeCompare(b.garageNumber ?? '', 'ru', { numeric: true }),
    )
}
