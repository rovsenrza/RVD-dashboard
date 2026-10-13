import type { DashboardSummary } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { ruleParams } from '../equipment/query.ts'
import { PLANNED_AT, STATUS_SQL, statusAt } from '../products/health.ts'
import type { Clock } from '../products/query.ts'
import { replacementTotals } from '../replacements/query.ts'

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
 * deltas compare with `days` ago (30, 90 or 365 — the period the dashboard
 * picks): hoses shipped since, and how many were on warranty or due for
 * replacement then (only hoses already in service then). Swaps are counted by
 * the journal's rule (`replacements/query.ts`), against the period before.
 */
export async function dashboardSummary(
  db: Db,
  clock: Clock,
  clients?: string[],
  days = 30,
): Promise<DashboardSummary> {
  const params = [...ruleParams(clock), clients ?? null]
  const {
    rows: [t],
  } = await db.query<Totals>(
    `with p as (
       select ${STATUS_SQL} as status,
         case when coalesce(installed_at, shipped_at) <= $1::date - $6::int
              then ${statusAt('($1::date - $6::int)')} end as status_then,
         installed_at, shipped_at, equipment_id
       from products where lifecycle <> 'written_off' and ($5::text[] is null or client_id = any($5))
     )
     select count(*)::int as shipped_total,
       -- On a machine is in service: 1С rarely records the installation itself (customer, 2026-10-13).
       count(*) filter (where equipment_id is not null)::int as in_operation,
       count(*) filter (where status = 'ok')::int as ok,
       count(*) filter (where status = 'warn')::int as warn,
       count(*) filter (where status = 'replace')::int as replace,
       count(*) filter (where status = 'no_warranty')::int as no_warranty,
       count(*) filter (where shipped_at > $1::date - $6::int)::int as shipped_lately,
       count(*) filter (where status_then = 'ok')::int as ok_then,
       count(*) filter (where status_then = 'replace')::int as replace_then
     from p`,
    [...params, days],
  )
  // Nearest planned replacements of hoses in service on a machine; installation is rarely
  // recorded in 1С, so shipment starts the clock as everywhere else.
  const { rows: upcoming } = await db.query<DashboardSummary['upcoming'][number]>(
    `with p as (
       select products.*, ${STATUS_SQL} as status, ${PLANNED_AT} as planned_at from products
       where lifecycle <> 'written_off' and equipment_id is not null and warranty_days > 0
         and ($5::text[] is null or client_id = any($5))
     )
     select p.id as "productId", p.serial_number as "serialNumber",
       coalesce(e.garage_number, '—') as equipment, to_char(p.planned_at, 'YYYY-MM-DD') as "dueDate"
     from p left join equipment e on e.id = p.equipment_id
     where p.status <> 'replace' and p.planned_at >= $1::date
     order by p.planned_at, length(p.serial_number), p.serial_number
     limit 8`,
    params,
  )
  const swaps = await replacementTotals(db, clock.today, clients, days)
  // Hoses made for the company per month, the last 12 months to today: those made to replace
  // one of theirs apart from the rest (customer, 2026-10-13: «изделия по месяцам»).
  const { rows: made } = await db.query<{ month: string; made: number; replaced: number }>(
    `with m as (
       select to_char(d, 'YYYY-MM') as month
       from generate_series(date_trunc('month', $1::date) - interval '11 months',
                            date_trunc('month', $1::date), interval '1 month') as d
     ),
     p as (
       select to_char((data->>'manufacturedAt')::date, 'YYYY-MM') as month,
         data->>'replacedProductId' is not null as replaced
       from products
       where data->>'manufacturedAt' is not null and ($2::text[] is null or client_id = any($2))
     )
     select m.month,
       count(p.month) filter (where not p.replaced)::int as made,
       count(p.month) filter (where p.replaced)::int as replaced
     from m left join p on p.month = m.month
     group by m.month order by m.month`,
    [clock.today, clients ?? null],
  )
  return {
    shippedTotal: t.shipped_total,
    inOperation: t.in_operation,
    onWarranty: t.ok,
    expiringSoon: t.warn,
    needsReplacement: t.replace,
    periodDays: days,
    replacementsInPeriod: swaps.inPeriod,
    deltas: {
      shippedTotal: t.shipped_lately,
      replacements: swaps.delta,
      onWarranty: t.ok - t.ok_then,
      needsReplacement: t.replace - t.replace_then,
    },
    statusBreakdown: { ok: t.ok, warn: t.warn, replace: t.replace, no_warranty: t.no_warranty },
    productsByMonth: made,
    upcoming,
  }
}
