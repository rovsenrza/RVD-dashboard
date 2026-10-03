import { ProductListQuery, type Equipment, type Product } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { PLANNED_AT, STATUS_SQL } from '../products/health.ts'
import { listProducts, type Clock } from '../products/query.ts'

export const ruleParams = (clock: Clock) => [
  clock.today,
  clock.rules.warnRule,
  clock.rules.warnPercent,
  clock.rules.warnDays,
]

/**
 * What sits on each machine for the given day and rules — the same status rule
 * as the registry; written-off hoses no longer count.
 */
const ON_MACHINE = `on_machine as (
  select equipment_id,
    count(*)::int as hose_count,
    count(*) filter (where status = 'ok')::int as ok,
    count(*) filter (where status = 'warn')::int as warn,
    count(*) filter (where status = 'replace')::int as replace,
    count(*) filter (where status = 'no_warranty')::int as no_warranty,
    to_char(min(planned_at), 'YYYY-MM-DD') as next_planned
  from (
    select equipment_id, ${STATUS_SQL} as status, ${PLANNED_AT} as planned_at
    from products where equipment_id is not null and lifecycle <> 'written_off'
  ) p
  group by equipment_id
)`

const MACHINE = `e.data || jsonb_build_object(
  'hoseCount', coalesce(m.hose_count, 0),
  'statusBreakdown', jsonb_build_object(
    'ok', coalesce(m.ok, 0), 'warn', coalesce(m.warn, 0),
    'replace', coalesce(m.replace, 0), 'no_warranty', coalesce(m.no_warranty, 0)),
  'nextPlannedReplacement', m.next_planned)`

/** «Моя техника»: every machine with its hoses counted for today. */
export async function listEquipment(db: Db, clock: Clock): Promise<Equipment[]> {
  const { rows } = await db.query<{ machine: Equipment }>(
    `with ${ON_MACHINE}
     select ${MACHINE} as machine
     from equipment e left join on_machine m on m.equipment_id = e.id
     order by e.garage_number, e.id`,
    ruleParams(clock),
  )
  return rows.map((r) => r.machine)
}

export async function getEquipment(db: Db, id: string, clock: Clock): Promise<Equipment | null> {
  const { rows } = await db.query<{ machine: Equipment }>(
    `with ${ON_MACHINE}
     select ${MACHINE} as machine
     from equipment e left join on_machine m on m.equipment_id = e.id
     where e.id = $5`,
    [...ruleParams(clock), id],
  )
  return rows[0]?.machine ?? null
}

/** The hoses on one machine now, each with its status for today. */
export async function equipmentProducts(db: Db, id: string, clock: Clock): Promise<Product[]> {
  const query = ProductListQuery.parse({ equipment: id, archive: '0', limit: 5000 })
  return (await listProducts(db, query, clock)).items
}
