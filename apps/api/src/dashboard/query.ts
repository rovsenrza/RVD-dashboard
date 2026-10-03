import type { DashboardSummary } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { ruleParams } from '../equipment/query.ts'
import { PLANNED_AT, STATUS_SQL, statusAt } from '../products/health.ts'
import type { Clock } from '../products/query.ts'

interface Totals {
  shipped_total: number
  in_operation: number
  ok: number
  warn: number
  replace: number
  no_warranty: number
  shipped_lately: number
  ok_then: number
  replace_then: number
}

/**
 * «Главная» from the cache, by the same status rule as the registry. The
 * deltas compare with 30 days ago: hoses shipped since, and how many were on
 * warranty or due for replacement then (only hoses already in service then).
 * Replacements come from 1С with Д16; until then there are none to count.
 */
export async function dashboardSummary(
  db: Db,
  clock: Clock,
  client?: string,
): Promise<DashboardSummary> {
  const params = [...ruleParams(clock), client ?? null]
  const {
    rows: [t],
  } = await db.query<Totals>(
    `with p as (
       select ${STATUS_SQL} as status,
         case when coalesce(installed_at, shipped_at) <= $1::date - 30
              then ${statusAt('($1::date - 30)')} end as status_then,
         installed_at, shipped_at
       from products where lifecycle <> 'written_off' and ($5::text is null or client_id = $5)
     )
     select count(*)::int as shipped_total,
       count(*) filter (where installed_at is not null)::int as in_operation,
       count(*) filter (where status = 'ok')::int as ok,
       count(*) filter (where status = 'warn')::int as warn,
       count(*) filter (where status = 'replace')::int as replace,
       count(*) filter (where status = 'no_warranty')::int as no_warranty,
       count(*) filter (where shipped_at > $1::date - 30)::int as shipped_lately,
       count(*) filter (where status_then = 'ok')::int as ok_then,
       count(*) filter (where status_then = 'replace')::int as replace_then
     from p`,
    params,
  )
  // Nearest planned replacements of hoses in service on a machine; installation is rarely
  // recorded in 1С, so shipment starts the clock as everywhere else.
  const { rows: upcoming } = await db.query<DashboardSummary['upcoming'][number]>(
    `with p as (
       select products.*, ${STATUS_SQL} as status, ${PLANNED_AT} as planned_at from products
       where lifecycle <> 'written_off' and equipment_id is not null and service_life_days > 0
         and ($5::text is null or client_id = $5)
     )
     select p.id as "productId", p.serial_number as "serialNumber",
       coalesce(e.garage_number, '—') as equipment, to_char(p.planned_at, 'YYYY-MM-DD') as "dueDate"
     from p left join equipment e on e.id = p.equipment_id
     where p.status <> 'replace' and p.planned_at >= $1::date
     order by p.planned_at, length(p.serial_number), p.serial_number
     limit 8`,
    params,
  )
  return {
    shippedTotal: t.shipped_total,
    inOperation: t.in_operation,
    onWarranty: t.ok,
    expiringSoon: t.warn,
    needsReplacement: t.replace,
    replacementsInPeriod: 0,
    deltas: {
      shippedTotal: t.shipped_lately,
      replacements: 0,
      onWarranty: t.ok - t.ok_then,
      needsReplacement: t.replace - t.replace_then,
    },
    statusBreakdown: { ok: t.ok, warn: t.warn, replace: t.replace, no_warranty: t.no_warranty },
    replacementsByMonth: [],
    upcoming,
  }
}
