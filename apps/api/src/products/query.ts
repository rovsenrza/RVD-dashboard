import type { Paginated, Product, ProductListQuery, StatusRules } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { PLANNED_AT, STATUS_SQL } from './health.ts'

export interface Clock {
  today: string
  rules: StatusRules
}

/** Each sort is one or more expressions; the direction applies to every one of them. */
const ORDER: Record<ProductListQuery['sort'], string[]> = {
  serialNumber: ['length(serial_number)', 'serial_number'],
  type: ['type'],
  catalogNumber: [`data->>'catalogNumber'`],
  shippedAt: ['shipped_at'],
  installedAt: ['installed_at'],
  plannedAt: ['planned_at'],
  status: [`array_position(array['replace','warn','no_warranty','ok'], status)`],
  lifecycle: ['lifecycle'],
}

/** Escapes LIKE wildcards so a typed "%" or "_" searches for itself. */
const like = (q: string) => `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** The registry: filtered, sorted and paged in SQL; `status` is derived per row for the given day and rules. */
export async function listProducts(
  db: Db,
  query: ProductListQuery,
  clock: Clock,
): Promise<Paginated<Product>> {
  const params: unknown[] = [
    clock.today,
    clock.rules.warnRule,
    clock.rules.warnPercent,
    clock.rules.warnDays,
  ]
  const where: string[] = []
  const add = (sql: string, value: unknown) => {
    params.push(value)
    where.push(sql.replace('?', `$${params.length}`))
  }

  if (query.q) add(`search like ? escape '\\'`, like(query.q))
  if (query.status) add('status = ?', query.status)
  if (query.lifecycle) add('lifecycle = ?', query.lifecycle)
  if (query.equipment) add('equipment_id = ?', query.equipment)
  if (query.catalog) add('catalog_number_id = ?', query.catalog)
  if (query.branch) add('branch_id = ?', query.branch)
  if (query.client) add('client_id = ?', query.client)
  if (query.installed === '1') where.push('installed_at is not null')
  if (query.installed === '0') where.push('installed_at is null')
  if (query.archive === '1') where.push(`lifecycle = 'written_off'`)
  if (query.archive === '0') where.push(`lifecycle <> 'written_off'`)

  params.push(query.limit, (query.page - 1) * query.limit)
  const dir = query.dir === 'desc' ? 'desc' : 'asc'
  const { rows } = await db.query<{ product: Product; total: string }>(
    `with p as (
       select products.*, ${STATUS_SQL} as status, ${PLANNED_AT} as planned_at from products
     )
     select data || jsonb_build_object('status', status) as product, count(*) over() as total
     from p
     ${where.length ? `where ${where.join(' and ')}` : ''}
     order by ${ORDER[query.sort].map((e) => `${e} ${dir} nulls last`).join(', ')}, id
     limit $${params.length - 1} offset $${params.length}`,
    params,
  )
  return {
    items: rows.map((r) => r.product),
    total: rows.length ? Number(rows[0].total) : 0,
    page: query.page,
    limit: query.limit,
  }
}

/** One hose; with `client`, only if it is that client's — anyone else's is as absent as a typo. */
export async function getProduct(
  db: Db,
  id: string,
  clock: Clock,
  client?: string,
): Promise<Product | null> {
  const { rows } = await db.query<{ product: Product }>(
    `with p as (select products.*, ${STATUS_SQL} as status from products)
     select data || jsonb_build_object('status', status) as product from p
     where id = $5 and ($6::text is null or client_id = $6)`,
    [
      clock.today,
      clock.rules.warnRule,
      clock.rules.warnPercent,
      clock.rules.warnDays,
      id,
      client ?? null,
    ],
  )
  return rows[0]?.product ?? null
}
