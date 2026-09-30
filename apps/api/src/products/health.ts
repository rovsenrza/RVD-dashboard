/**
 * The status rule of packages/contracts/src/status.ts, written in SQL so the
 * registry can filter and sort by it on the server. Parameters, always first:
 * $1 today (date), $2 warnRule, $3 warnPercent, $4 warnDays. `status.test.ts`
 * holds the two implementations to the same answers.
 */
const START = 'coalesce(installed_at, shipped_at)'
const SPAN = `least(greatest(case when $2::text = 'percent' then round(service_life_days * $3::numeric / 100) else $4::numeric end, 0), service_life_days)`

export const PLANNED_AT = `(${START} + service_life_days)`
export const WARN_FROM = `(${START} + (service_life_days - ${SPAN})::int)`
export const WARRANTY_UNTIL = `(${START} + warranty_days)`

export const STATUS_SQL = `case
  when ${START} is null or service_life_days = 0 then 'no_warranty'
  when $1::date >= ${PLANNED_AT} then 'replace'
  when $1::date >= ${WARN_FROM} then 'warn'
  when $1::date >= ${WARRANTY_UNTIL} then 'no_warranty'
  else 'ok' end`
