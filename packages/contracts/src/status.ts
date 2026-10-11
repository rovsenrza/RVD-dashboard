import { addDays, differenceInCalendarDays, formatISO, parseISO } from 'date-fns'
import type { CabinetSettings, LifetimePhase, Product, ProductStatus } from './types'

/**
 * The status rule (Д13): the one place hose health is derived. The mocks, the
 * BFF and the UI all call it from here — so the badge, the timeline, the
 * dashboard and the reports can never disagree about a hose.
 */

export type StatusRules = Pick<CabinetSettings, 'warnRule' | 'warnPercent' | 'warnDays'>

/**
 * The «Внимание» setting is no longer read: the customer (2026-10-11) laid the
 * whole life out on the warranty instead. Its fields stay in the settings so
 * the stored rows and the action log keep their shape.
 */
export const DEFAULT_RULES: StatusRules = { warnRule: 'days', warnPercent: 20, warnDays: 30 }
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
  /** «Внимание» from this day: half the warranty */
  warnFrom: string
  /** Planned replacement, «Пора менять» from this day: three quarters of the warranty */
  plannedAt: string
  /** The end of the stretch past the warranty, as long as «Пора менять»; the timeline stops here */
  endsAt: string
}

const day = (d: Date) => formatISO(d, { representation: 'date' })
const plus = (iso: string, days: number) => day(addDays(parseISO(iso), days))

/**
 * The customer's life of a hose (2026-10-11), all of it measured on the warranty:
 * green the first 50 %, yellow the next 25 %, red the last 25 %, then grey past
 * the warranty for as long as the red, after which the timeline stops.
 */
export const warnDay = (warrantyDays: number) => Math.round(warrantyDays * 0.5)
export const plannedDay = (warrantyDays: number) => Math.round(warrantyDays * 0.75)

export function serviceDates(p: ServiceFacts, _rules?: StatusRules): ServiceDates | null {
  const start = p.installedAt || p.shippedAt
  if (!start || p.warrantyDays <= 0) return null
  const w = p.warrantyDays
  return {
    start,
    basis: p.installedAt ? 'installed' : 'shipped',
    warrantyUntil: plus(start, w),
    warnFrom: plus(start, warnDay(w)),
    plannedAt: plus(start, plannedDay(w)),
    endsAt: plus(start, 2 * w - plannedDay(w)),
  }
}

/**
 * From the planned day on the hose is to be replaced, and stays so past the
 * warranty: the grey stretch is a phase of the timeline, not a better status.
 * Every boundary day belongs to the later phase, as in `lifetimePhases`.
 */
export function statusOf(p: ServiceFacts, rules?: StatusRules, today = new Date()): ProductStatus {
  const d = serviceDates(p, rules)
  if (!d) return 'no_warranty'
  const t = day(today)
  if (t >= d.plannedAt) return 'replace'
  if (t >= d.warnFrom) return 'warn'
  return 'ok'
}

/** The same rule laid out on a time axis: back-to-back phases, ending where the timeline stops. */
export function lifetimePhases(d: ServiceDates): LifetimePhase[] {
  return [
    { status: 'ok', from: d.start, to: d.warnFrom },
    { status: 'warn', from: d.warnFrom, to: d.plannedAt },
    { status: 'replace', from: d.plannedAt, to: d.warrantyUntil },
    { status: 'no_warranty', from: d.warrantyUntil, to: d.endsAt },
  ]
}

/** Days to the planned replacement; negative when overdue, null without a start date or warranty. */
export function daysLeft(p: ServiceFacts, today = new Date()) {
  const d = serviceDates(p)
  return d ? differenceInCalendarDays(parseISO(d.plannedAt), today) : null
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

/** The stored setting in words, for the action log. */
export function warnRuleLabel(rules: StatusRules) {
  return rules.warnRule === 'percent'
    ? `последние ${rules.warnPercent} % срока эксплуатации`
    : `последние ${rules.warnDays} дн. до плановой замены`
}
