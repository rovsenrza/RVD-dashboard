import { DEFAULT_RULES, rulesProblem } from './status'
import type { CabinetSettings } from './types'

/** How many days ahead a company may be warned: the form offers these, the server takes only these. */
export const LEAD_DAY_OPTIONS: readonly number[] = [60, 30, 14, 7, 3, 1]

/** How often a company may be reminded to inspect each machine's hoses, in days; 0 — never. */
export const INSPECTION_DAY_OPTIONS: readonly number[] = [0, 30, 60, 90, 180]
export const INSPECTION_LABEL: Record<number, string> = {
  0: 'Не напоминать',
  30: 'Раз в месяц',
  60: 'Раз в два месяца',
  90: 'Раз в квартал',
  180: 'Раз в полгода',
}

/**
 * A company that never opened its settings works by these. ТЗ 3.6 asks for
 * inspection reminders without an interval: a quarter until the customer
 * names one (question 21).
 */
export const DEFAULT_SETTINGS: CabinetSettings = {
  ...DEFAULT_RULES,
  leadDays: [30, 14, 7],
  channels: { inApp: true, email: false },
  inspectionDays: 90,
}

/** Server-side check of a settings patch: the «Внимание» rule, the lead days, the channels, the inspections. */
export function settingsProblem(patch: Partial<CabinetSettings>): string | null {
  const rules = rulesProblem(patch)
  if (rules) return rules
  const days = patch.leadDays
  if (
    days !== undefined &&
    (!Array.isArray(days) ||
      days.some((d) => !LEAD_DAY_OPTIONS.includes(d)) ||
      new Set(days).size !== days.length)
  )
    return `Предупреждать можно только за ${LEAD_DAY_OPTIONS.join(', ')} дней`
  const channels = patch.channels
  if (
    channels !== undefined &&
    (typeof channels?.inApp !== 'boolean' || typeof channels?.email !== 'boolean')
  )
    return 'Каналы уведомлений указаны неверно'
  if (patch.inspectionDays !== undefined && !INSPECTION_DAY_OPTIONS.includes(patch.inspectionDays))
    return `Осмотр можно назначить раз в ${INSPECTION_DAY_OPTIONS.filter(Boolean).join(', ')} дней или не напоминать`
  return null
}

/** Only the fields a settings patch may carry, whatever else the body holds. */
export function settingsPatch(body: unknown): Partial<CabinetSettings> {
  const b = (body ?? {}) as Record<string, unknown>
  const keys = [
    'warnRule',
    'warnPercent',
    'warnDays',
    'leadDays',
    'channels',
    'inspectionDays',
  ] as const
  return Object.fromEntries(keys.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]))
}
