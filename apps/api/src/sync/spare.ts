import type { Db } from '../db/pool.ts'
import type { Spare } from '../onec/sources.ts'

/** A set or step 1С did not give this run, and its answer. */
export interface SetFailure {
  entity: string
  error: string
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * Reads through the last good copies in `onec_snapshots`: a set read whole is
 * saved, one that fails is taken from its copy and noted in `failed`. With no
 * copy yet the failure stands — the sync stops, as before, rather than drop a set.
 */
export function spareFor(db: Db, failed: SetFailure[]): Spare {
  return async <T>(entity: string, fetch: () => Promise<T[]>, keep?: (row: T) => boolean) => {
    try {
      const rows = await fetch()
      if (!keep)
        await db.query(
          `insert into onec_snapshots (entity, rows) values ($1, $2::jsonb)
           on conflict (entity) do update set rows = excluded.rows, saved_at = now()`,
          [entity, JSON.stringify(rows)],
        )
      return rows
    } catch (error) {
      const { rows } = await db.query<{ rows: T[] }>(
        'select rows from onec_snapshots where entity = $1',
        [entity],
      )
      if (!rows[0]) throw error
      failed.push({ entity, error: message(error) })
      return keep ? rows[0].rows.filter(keep) : rows[0].rows
    }
  }
}

/** A step past the cache itself — orders, request statuses, the discrepancy letter: on failure, `otherwise`. */
export async function optional<T>(
  failed: SetFailure[],
  entity: string,
  step: () => Promise<T>,
  otherwise: T,
): Promise<T> {
  try {
    return await step()
  } catch (error) {
    failed.push({ entity, error: message(error) })
    return otherwise
  }
}
