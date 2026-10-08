import type { BranchSummary } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'

/**
 * «Филиалы» (Д22): the company's branches — its clients in 1С — with what the
 * cabinet holds for each: machines, hoses in work, and the active people who
 * see it (bound to it, or to the whole company). The cache keeps no 1С codes
 * or addresses of clients.
 */
export async function listBranches(db: Db, companyId: string): Promise<BranchSummary[]> {
  const { rows } = await db.query<BranchSummary>(
    `select b.client_key as id, b.company_id as "companyId", b.name, '' as code, null as address,
       (select count(*) from equipment e where e.client_id = b.client_key)::int as "equipmentCount",
       (select count(*) from products p
         where p.client_id = b.client_key and p.lifecycle <> 'written_off')::int as "productCount",
       (select count(*) from users u
         where u.company_id = b.company_id and u.active
           and (not exists (select 1 from user_branches ub where ub.user_id = u.id)
             or exists (select 1 from user_branches ub
                         where ub.user_id = u.id and ub.client_key = b.client_key)))::int
         as "userCount"
     from company_branches b where b.company_id = $1
     order by b.name, b.client_key`,
    [companyId],
  )
  return rows
}
