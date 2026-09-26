import { addDays, differenceInCalendarDays, formatISO, parseISO } from 'date-fns'
import type { CabinetSettings, LifetimePhase, Product, ProductStatus } from '@/entities/types'

/**
 * The status rule (Д13): the one place hose health is derived. The mocks call it
 * the way the BFF will, the UI calls it for day counts, and on the monorepo it
 * moves unchanged to packages/contracts/status.ts — so the badge, the timeline,
 * the dashboard and the reports can never disagree about a hose.
 */

export type StatusRules = Pick<CabinetSettings, 'warnRule' | 'warnPercent' | 'warnDays'>

/**
 * ТЗ conflicts on «Внимание» (PLAN.md §5, q. 4): «последние 20 %» of the service
 * life, or a fixed stretch before the planned replacement (10–11,99 мес. at 12 —
 * the last two months). Both are offered; the administrator picks until the
 * customer settles it.
 */
export const DEFAULT_RULES: StatusRules = { warnRule: 'percent', warnPercent: 20, warnDays: 60 }
export const WARN_PERCENT_RANGE = [5, 50] as const
export const WARN_DAYS_RANGE = [7, 180] as const

/** What the rule reads from a hose. */
export type ServiceFacts = Pick<
  Product,
  'installedAt' | 'shippedAt' | 'serviceLifeDays' | 'warrantyDays'
>

/** The day service is counted from: installation, or shipment when it is unknown (ТЗ). */
export type ServiceBasis = 'installed' | 'shipped'

export interface ServiceDates {
  start: string
  basis: ServiceBasis
  warrantyUntil: string
  /** «Внимание» from this day */
  warnFrom: string
  /** Planned replacement: start + service life; «Требуется замена» from this day */
  plannedAt: string
}

const day = (d: Date) => formatISO(d, { representation: 'date' })
const plus = (iso: string, days: number) => day(addDays(parseISO(iso), days))

/** How many days before the planned replacement «Внимание» begins, never past the start. */
export function warnSpan(lifeDays: number, rules: StatusRules) {
  const span =
    rules.warnRule === 'percent' ? Math.round((lifeDays * rules.warnPercent) / 100) : rules.warnDays
  return Math.min(Math.max(span, 0), lifeDays)
}

export function serviceDates(p: ServiceFacts, rules: StatusRules): ServiceDates | null {
  const start = p.installedAt || p.shippedAt
  if (!start) return null
  return {
    start,
    basis: p.installedAt ? 'installed' : 'shipped',
    warrantyUntil: plus(start, p.warrantyDays),
    warnFrom: plus(start, p.serviceLifeDays - warnSpan(p.serviceLifeDays, rules)),
    plannedAt: plus(start, p.serviceLifeDays),
  }
}

/**
 * Worst condition wins: past the planned date → replace; in the «Внимание»
 * stretch → warn, even under warranty; past the warranty → no_warranty.
 * Every boundary day belongs to the later phase, as in `lifetimePhases`.
 */
export function statusOf(p: ServiceFacts, rules: StatusRules, today = new Date()): ProductStatus {
  const d = serviceDates(p, rules)
  if (!d) return 'no_warranty'
  const t = day(today)
  if (t >= d.plannedAt) return 'replace'
  if (t >= d.warnFrom) return 'warn'
  if (t >= d.warrantyUntil) return 'no_warranty'
  return 'ok'
}

/** The same rule laid out on a time axis: back-to-back phases, the last one open-ended. */
export function lifetimePhases(d: ServiceDates): LifetimePhase[] {
  const warrantyFirst = d.warrantyUntil < d.warnFrom
  return [
    { status: 'ok', from: d.start, to: warrantyFirst ? d.warrantyUntil : d.warnFrom },
    ...(warrantyFirst
      ? [{ status: 'no_warranty' as const, from: d.warrantyUntil, to: d.warnFrom }]
      : []),
    { status: 'warn', from: d.warnFrom, to: d.plannedAt },
    { status: 'replace', from: d.plannedAt, to: null },
  ]
}

/** Days to the planned replacement; negative when overdue, null without a start date. */
export function daysLeft(p: ServiceFacts, today = new Date()) {
  const start = p.installedAt || p.shippedAt
  if (!start) return null
  return differenceInCalendarDays(parseISO(plus(start, p.serviceLifeDays)), today)
}

/** Server-side check of a settings patch; the form checks the same ranges. */
export function rulesProblem(patch: Partial<StatusRules>): string | null {
  const whole = (v: unknown, [min, max]: readonly [number, number]) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max
  if (patch.warnRule !== undefined && patch.warnRule !== 'percent' && patch.warnRule !== 'days')
    return 'Неизвестное правило «Внимание»'
  if (patch.warnPercent !== undefined && !whole(patch.warnPercent, WARN_PERCENT_RANGE))
    return `Доля срока — целое число от ${WARN_PERCENT_RANGE[0]} до ${WARN_PERCENT_RANGE[1]}`
  if (patch.warnDays !== undefined && !whole(patch.warnDays, WARN_DAYS_RANGE))
    return `Дни до замены — целое число от ${WARN_DAYS_RANGE[0]} до ${WARN_DAYS_RANGE[1]}`
  return null
}

/** The rule in words, for settings, the action log and hints. */
export function warnRuleLabel(rules: StatusRules) {
  return rules.warnRule === 'percent'
    ? `последние ${rules.warnPercent} % срока эксплуатации`
    : `последние ${rules.warnDays} дн. до плановой замены`
}
