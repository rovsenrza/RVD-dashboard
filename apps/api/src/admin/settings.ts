import { DEFAULT_SETTINGS, settingsProblem, type CabinetSettings } from '@rvd/contracts'
import { AuthRejected } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'

/** The company's settings: what its administrator changed, over the defaults. */
export async function companySettings(db: Db, companyId: string): Promise<CabinetSettings> {
  const { rows } = await db.query<{ settings: Partial<CabinetSettings> }>(
    'select settings from companies where id = $1',
    [companyId],
  )
  return { ...DEFAULT_SETTINGS, ...rows[0]?.settings }
}

/** Checks a patch by the form's rule and stores it; answers the settings before and after. */
export async function saveSettings(
  db: Db,
  companyId: string,
  patch: Partial<CabinetSettings>,
): Promise<{ before: CabinetSettings; after: CabinetSettings }> {
  const problem = settingsProblem(patch)
  if (problem) throw new AuthRejected(422, problem)
  const before = await companySettings(db, companyId)
  await db.query('update companies set settings = settings || $2::jsonb where id = $1', [
    companyId,
    JSON.stringify(patch),
  ])
  return { before, after: { ...before, ...patch } }
}
