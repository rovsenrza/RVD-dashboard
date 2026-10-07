import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Equipment, ModelStats, Product, ProductStatus, Replacement } from './types'

/** The swap reason that counts as a failure. */
const FAILURE = 'Поломка'

const mostCommon = (values: (string | null)[]) => {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Machine models side by side (Д15), for the mock and the API alike: what is on
 * each model's machines now (their counts, already worked out for today) and how
 * their hoses fared over the 365 days to `today`. Until 1С publishes its model
 * catalogue a machine is known by its brand alone, so brands are what compare.
 */
export function modelStats(
  data: { equipment: Equipment[]; products: Product[]; replacements: Replacement[] },
  today: string,
): ModelStats[] {
  const since = new Date(parseISO(today).getTime() - 365 * 86_400_000).toISOString().slice(0, 10)
  const product = new Map(data.products.map((p) => [p.id, p]))
  const groups = new Map<string, Equipment[]>()
  for (const e of data.equipment) {
    const key = [e.brand, e.model].filter(Boolean).join(' ') || e.type || 'Без марки'
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  return [...groups]
    .map(([model, machines]): ModelStats => {
      const ids = new Set<string | null>(machines.map((m) => m.id))
      const breakdown: Record<ProductStatus, number> = {
        ok: 0,
        warn: 0,
        replace: 0,
        no_warranty: 0,
      }
      for (const m of machines)
        for (const k of Object.keys(breakdown) as ProductStatus[])
          breakdown[k] += m.statusBreakdown[k]
      const swaps = data.replacements.filter((r) => ids.has(r.equipmentId) && r.date >= since)
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
        model,
        type: machines[0].type,
        machines: machines.length,
        hoses: machines.reduce((sum, m) => sum + m.hoseCount, 0),
        breakdown,
        replacements12m: swaps.length,
        replacementsPerMachine: round1(swaps.length / machines.length),
        failureShare: reasoned.length
          ? reasoned.filter((r) => r.reason === FAILURE).length / reasoned.length
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
    .sort((a, b) => b.machines - a.machines || a.model.localeCompare(b.model))
}
