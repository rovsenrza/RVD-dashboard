import type { DashboardSummary, Replacement } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'

/**
 * Swaps from 1С: a new hose naming the one it replaces (`ЗаменяемоеИзделие_Key`). A swap
 * counts once the new hose has left the supplier and is dated by its installation, else its
 * shipment — the clock everything else runs on; before that it is an order in progress and
 * shows under «Заявки». Both hoses must be the same client's: 1С holds a link across
 * clients, and a company must not read another's serial numbers. `client` is the
 * placeholder of the client parameter in the query that uses it.
 */
const swaps = (client: string) => `swaps as (
  select n.id, o.id as old_id, o.serial_number as old_serial, n.serial_number as new_serial,
    coalesce(n.equipment_id, o.equipment_id) as equipment_id,
    coalesce(n.installed_at, n.shipped_at) as date
  from products n
  join products o on o.id = n.replaced_product_id and o.client_id = n.client_id
  where n.replaced_product_id is not null and coalesce(n.installed_at, n.shipped_at) is not null
    and (${client}::text is null or n.client_id = ${client})
)`

interface Row {
  id: string
  old_id: string
  old_serial: string
  new_serial: string
  equipment_id: string | null
  garage_number: string | null
  day: string
}

/** Which swaps to list; each narrows the client's journal. */
export interface ReplacementFilter {
  client?: string
  /** Swaps this hose took part in, as the one taken off or the one put on */
  product?: string
  /** Swaps on this machine */
  equipment?: string
}

/** «История замен», newest first; 1С keeps no reason, usage or performer for a swap. */
export async function listReplacements(
  db: Db,
  filter: ReplacementFilter = {},
): Promise<Replacement[]> {
  const { rows } = await db.query<Row>(
    `with ${swaps('$1')}
     select s.id, s.old_id, s.old_serial, s.new_serial, s.equipment_id, e.garage_number,
       to_char(s.date, 'YYYY-MM-DD') as day
     from swaps s left join equipment e on e.id = s.equipment_id
     where ($2::text is null or s.id = $2 or s.old_id = $2)
       and ($3::text is null or s.equipment_id = $3)
     order by s.date desc, s.id`,
    [filter.client ?? null, filter.product ?? null, filter.equipment ?? null],
  )
  return rows.map((r) => ({
    id: r.id,
    oldProductId: r.old_id,
    oldSerialNumber: r.old_serial,
    newProductId: r.id,
    newSerialNumber: r.new_serial,
    equipmentId: r.equipment_id,
    garageNumber: r.garage_number,
    date: r.day,
    reason: null,
    operatingHours: null,
    usageUnit: 'hours',
    performedBy: null,
    comment: null,
    attachments: [],
  }))
}

export interface ReplacementTotals {
  /** Swaps in the last `days`, today included — what «/replacements?period=<days>» lists */
  inPeriod: number
  /** Against the same number of days before those */
  delta: number
  /** The last 12 months, this one included, empty months as zero */
  byMonth: DashboardSummary['replacementsByMonth']
}

/** The dashboard's swap figures, by the same rule as the journal. */
export async function replacementTotals(
  db: Db,
  today: string,
  client?: string,
  days = 30,
): Promise<ReplacementTotals> {
  const {
    rows: [t],
  } = await db.query<{ lately: number; before: number; by_month: ReplacementTotals['byMonth'] }>(
    `with ${swaps('$2')}
     select
       (select count(*) from swaps where date >= $1::date - $3::int)::int as lately,
       (select count(*) from swaps
         where date >= $1::date - 2 * $3::int and date < $1::date - $3::int)::int as before,
       (select json_agg(json_build_object(
                'month', to_char(m, 'YYYY-MM'),
                'count', (select count(*) from swaps where date_trunc('month', date) = m))
              order by m)
          from generate_series(date_trunc('month', $1::date) - interval '11 months',
                               date_trunc('month', $1::date), interval '1 month') m) as by_month`,
    [today, client ?? null, days],
  )
  return { inPeriod: t.lately, delta: t.lately - t.before, byMonth: t.by_month }
}
