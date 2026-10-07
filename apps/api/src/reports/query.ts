import {
  buildReport,
  modelStats,
  reportMeta,
  type ModelStats,
  type Product,
  type Report,
  type ReportData,
  type ReportId,
} from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { listEquipment, ruleParams } from '../equipment/query.ts'
import { STATUS_SQL } from '../products/health.ts'
import type { Clock } from '../products/query.ts'
import { listReplacements } from '../replacements/query.ts'
import { listRequests } from '../requests/store.ts'

/**
 * Everything a company has in the cache, whole — what reports and the model
 * comparison read. Hose statuses and machine counts follow the company's rule.
 */
async function companyData(
  db: Db,
  clock: Clock,
  client: string | undefined,
): Promise<Omit<ReportData, 'branches'>> {
  const [products, equipment, replacements, requests] = await Promise.all([
    db
      .query<{ product: Product }>(
        `select data || jsonb_build_object('status', ${STATUS_SQL}) as product from products
         where ($5::text is null or client_id = $5)`,
        [...ruleParams(clock), client ?? null],
      )
      .then((r) => r.rows.map((row) => row.product)),
    listEquipment(db, clock, client),
    listReplacements(db, { client }),
    listRequests(db, client),
  ])
  return { products, equipment, replacements, requests }
}

export interface ReportScope {
  /** The company's 1С client; undefined — every client (no sign-in, no client configured) */
  client?: string
  /** What the «по филиалам» rows are called: in 1С a client has one branch, so the company's name */
  companyName: string
  from: string | null
  to: string | null
}

/** A report (Д21) by the shared builder in @rvd/contracts — the demo builds the same from its data. */
export async function companyReport(
  db: Db,
  id: string,
  clock: Clock,
  scope: ReportScope,
): Promise<Report | null> {
  if (!reportMeta(id)) return null
  const data = await companyData(db, clock, scope.client)
  const branchIds = [...new Set([...data.products, ...data.equipment].map((r) => r.branchId))]
  return buildReport(
    id as ReportId,
    { ...data, branches: branchIds.map((branchId) => ({ id: branchId, name: scope.companyName })) },
    {
      branch: null,
      from: scope.from,
      to: scope.to,
      rules: clock.rules,
      today: clock.today,
      generatedAt: new Date().toISOString(),
    },
  )
}

/** «Сравнение техники» (Д15): the company's machine models over the last year. */
export async function companyModels(
  db: Db,
  clock: Clock,
  client: string | undefined,
): Promise<ModelStats[]> {
  return modelStats(await companyData(db, clock, client), clock.today)
}
