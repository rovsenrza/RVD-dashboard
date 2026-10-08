import type {
  Product,
  ProductListQuery,
  ProductPage,
  ProductSortKey,
  StatusRules,
} from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { PLANNED_AT, STATUS_SQL } from './health.ts'

export interface Clock {
  today: string
  rules: StatusRules
}

/** Each sort is one or more expressions; the direction applies to every one of them. */
const ORDER: Record<ProductSortKey, string[]> = {
  serialNumber: ['length(serial_number)', 'serial_number'],
  clientNumber: [`data->>'clientNumber'`],
  type: ['type'],
  catalogNumber: [`data->>'catalogNumber'`],
  manufacturer: [`data->>'manufacturer'`],
  shippedAt: ['shipped_at'],
  installedAt: ['installed_at'],
  plannedAt: ['planned_at'],
  status: [`array_position(array['replace','warn','no_warranty','ok'], status)`],
  lifecycle: ['lifecycle'],
  installPlace: [`data->>'installPlace'`],
}

/** The registry's two tabs: written-off hoses are the archive, the rest are in work. */
const IN_ARCHIVE = `lifecycle = 'written_off'`
const IN_WORK = `lifecycle <> 'written_off'`

/** Escapes LIKE wildcards so a typed "%" or "_" searches for itself. */
const like = (q: string) => `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`

const whereOf = (conditions: string[]) =>
  conditions.length ? `where ${conditions.join(' and ')}` : ''

/**
 * The registry: filtered, sorted and paged in SQL; `status` is derived per row
 * for the given day and rules. Every page carries the size of both tabs under
 * the same filters, counted apart from the page, so a page past the end still
 * knows the total.
 */
export async function listProducts(
  db: Db,
  query: ProductListQuery & { clients?: string[] },
  clock: Clock,
): Promise<ProductPage> {
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
  // A branch is one of the company's 1С clients: the route turns `branch` into `clients`.
  if (query.clients) add('client_id = any(?)', query.clients)
  if (query.client) add('client_id = ?', query.client)
  if (query.installed === '1') where.push('installed_at is not null')
  if (query.installed === '0') where.push('installed_at is null')
  const tab = query.archive === '1' ? [IN_ARCHIVE] : query.archive === '0' ? [IN_WORK] : []

  const scope = `with p as (
       select products.*, ${STATUS_SQL} as status, ${PLANNED_AT} as planned_at from products
     )`
  const dir = query.dir === 'desc' ? 'desc' : 'asc'
  const [page, counts] = await Promise.all([
    db.query<{ product: Product }>(
      `${scope}
       select data || jsonb_build_object('status', status) as product from p
       ${whereOf([...where, ...tab])}
       order by ${ORDER[query.sort].map((e) => `${e} ${dir} nulls last`).join(', ')}, id
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, query.limit, (query.page - 1) * query.limit],
    ),
    db.query<{ active: string; archive: string }>(
      `${scope}
       select count(*) filter (where ${IN_WORK}) as active,
              count(*) filter (where ${IN_ARCHIVE}) as archive
       from p ${whereOf(where)}`,
      params,
    ),
  ])
  const active = Number(counts.rows[0].active)
  const archive = Number(counts.rows[0].archive)
  return {
    items: page.rows.map((r) => r.product),
    total: query.archive === '1' ? archive : query.archive === '0' ? active : active + archive,
    page: query.page,
    limit: query.limit,
    counts: { active, archive },
  }
}

/** One hose; with `clients`, only if it is one of theirs — anyone else's is as absent as a typo. */
export async function getProduct(
  db: Db,
  id: string,
  clock: Clock,
  clients?: string[],
): Promise<Product | null> {
  const { rows } = await db.query<{ product: Product }>(
    `with p as (select products.*, ${STATUS_SQL} as status from products)
     select data || jsonb_build_object('status', status) as product from p
     where id = $5 and ($6::text[] is null or client_id = any($6))`,
    [
      clock.today,
      clock.rules.warnRule,
      clock.rules.warnPercent,
      clock.rules.warnDays,
      id,
      clients ?? null,
    ],
  )
  return rows[0]?.product ?? null
}
