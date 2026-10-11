/**
 * The status rule of packages/contracts/src/status.ts, written in SQL so the
 * registry can filter and sort by it on the server. Parameters, always first:
 * $1 today (date); $2–$4 are the old «Внимание» setting, passed but unused. `status.test.ts`
 * holds the two implementations to the same answers.
 */
const START = 'coalesce(installed_at, shipped_at)'
const PLANNED_DAY = 'round(warranty_days * 0.75)::int'

export const PLANNED_AT = `(${START} + ${PLANNED_DAY})`
export const WARN_FROM = `(${START} + round(warranty_days * 0.5)::int)`

// $2–$4 still arrive with every query but the rule no longer reads them; naming
// their types here keeps Postgres from refusing a parameter it cannot type.
export const STATUS_SQL = `case
  when ($2::text, $3::numeric, $4::numeric) is null then 'no_warranty'
  when ${START} is null or warranty_days <= 0 then 'no_warranty'
  when $1::date >= ${PLANNED_AT} then 'replace'
  when $1::date >= ${WARN_FROM} then 'warn'
  else 'ok' end`

/** The same rule for another day, e.g. `statusAt("($1::date - 30)")` for a month ago. */
export const statusAt = (day: string) => STATUS_SQL.replaceAll('$1::date', day)
