import type { Replacement, StaffMember } from '@rvd/contracts'
import { AuthRejected } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'

/**
 * Swaps from 1С: a new hose naming the one it replaces (`ЗаменяемоеИзделие_Key`). A swap
 * counts once the new hose has left the supplier and is dated by its installation, else its
 * shipment — the clock everything else runs on; before that it is an order in progress and
 * shows under «Заявки». Both hoses must be the reader's — their branches' clients, so a
 * swap may cross branches of one company; with no reader, one client's: 1С holds a link
 * across clients, and a company must not read another's serial numbers. `clients` is the
 * placeholder of the clients parameter in the query that uses it.
 */
const swaps = (clients: string) => `swaps as (
  select n.id, o.id as old_id, o.serial_number as old_serial, n.serial_number as new_serial,
    coalesce(n.equipment_id, o.equipment_id) as equipment_id,
    coalesce(n.installed_at, n.shipped_at) as date
  from products n
  join products o on o.id = n.replaced_product_id
    and ((${clients}::text[] is null and o.client_id = n.client_id) or o.client_id = any(${clients}))
  where n.replaced_product_id is not null and coalesce(n.installed_at, n.shipped_at) is not null
    and (${clients}::text[] is null or n.client_id = any(${clients}))
)`

interface Row {
  id: string
  old_id: string
  old_serial: string
  new_serial: string
  equipment_id: string | null
  garage_number: string | null
  day: string
  reason: string | null
  operating_hours: number | null
  usage_unit: 'hours' | 'km' | null
  performer_id: string | null
  performer: string | null
}

/** Which swaps to list; each narrows the client's journal. */
export interface ReplacementFilter {
  clients?: string[]
  /** Swaps this hose took part in, as the one taken off or the one put on */
  product?: string
  /** Swaps on this machine */
  equipment?: string
}

/**
 * «История замен», newest first. 1С keeps no reason, usage or performer for a swap: the
 * reason and running hours are what the client wrote in the latest replacement request
 * naming the hose taken off (customer, 2026-10-08); the performer is the client's own
 * pick in the cabinet (customer, 2026-10-22).
 */
export async function listReplacements(
  db: Db,
  filter: ReplacementFilter = {},
): Promise<Replacement[]> {
  const { rows } = await db.query<Row>(
    `with ${swaps('$1')}
     select s.id, s.old_id, s.old_serial, s.new_serial, s.equipment_id, e.garage_number,
       to_char(s.date, 'YYYY-MM-DD') as day, asked.line ->> 'reason' as reason,
       (asked.line ->> 'operatingHours')::int as operating_hours,
       asked.line ->> 'usageUnit' as usage_unit, rl.performer_id, u.name as performer
     from swaps s left join equipment e on e.id = s.equipment_id
     left join replacement_local rl on rl.product_id = s.id
     left join users u on u.id = rl.performer_id
     left join lateral (
       select l.line from requests r cross join jsonb_array_elements(r.positions) as l(line)
        where r.kind = 'replace' and l.line ->> 'productId' = s.old_id
        order by r.created_at desc limit 1
     ) asked on true
     where ($2::text is null or s.id = $2 or s.old_id = $2)
       and ($3::text is null or s.equipment_id = $3)
     order by s.date desc, s.id`,
    [filter.clients ?? null, filter.product ?? null, filter.equipment ?? null],
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
    reason: r.reason,
    operatingHours: r.operating_hours,
    usageUnit: r.usage_unit ?? 'hours',
    performerId: r.performer_id,
    performedBy: r.performer,
    comment: null,
    attachments: [],
  }))
}

/** Whom a swap may be credited to: the company's active staff. */
export async function listStaff(db: Db, companyId: string): Promise<StaffMember[]> {
  const { rows } = await db.query<StaffMember>(
    'select id, name from users where company_id = $1 and active order by name, id',
    [companyId],
  )
  return rows
}

/**
 * Records who swapped the hose on the machine, or clears it with null. The swap must be
 * one the reader sees, the performer one of their company's active staff.
 */
export async function savePerformer(
  db: Db,
  swapId: string,
  performerId: unknown,
  scope: { clients?: string[]; companyId: string },
): Promise<Replacement> {
  if (performerId !== null && typeof performerId !== 'string')
    throw new AuthRejected(400, 'Укажите, кто выполнил замену')
  const swap = (await listReplacements(db, { clients: scope.clients, product: swapId })).find(
    (r) => r.id === swapId,
  )
  if (!swap) throw new AuthRejected(404, 'Замена не найдена')
  if (performerId) {
    const staff = await listStaff(db, scope.companyId)
    if (!staff.some((m) => m.id === performerId))
      throw new AuthRejected(400, 'Такого сотрудника нет в компании')
  }
  await db.query(
    `insert into replacement_local (product_id, performer_id) values ($1, $2)
     on conflict (product_id) do update set performer_id = $2, updated_at = now()`,
    [swapId, performerId],
  )
  const after = await listReplacements(db, { clients: scope.clients, product: swapId })
  return after.find((r) => r.id === swapId)!
}

export interface ReplacementTotals {
  /** Swaps in the last `days`, today included — what «/replacements?period=<days>» lists */
  inPeriod: number
  /** Against the same number of days before those */
  delta: number
  /** The last 12 months, this one included, empty months as zero */
  byMonth: { month: string; count: number }[]
}

/** The dashboard's swap figures, by the same rule as the journal. */
export async function replacementTotals(
  db: Db,
  today: string,
  clients?: string[],
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
    [today, clients ?? null, days],
  )
  return { inPeriod: t.lately, delta: t.lately - t.before, byMonth: t.by_month }
}
