import type { SyncStatus } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import type { SetFailure } from './spare.ts'

interface HealthRow {
  synced_at: Date | null
  full_at: Date | null
  failed_since: Date | null
  last_error: string | null
  register_mark: string | null
  partial: SetFailure[] | null
}

export async function readHealth(db: Db): Promise<HealthRow> {
  const { rows } = await db.query<HealthRow>(
    'select synced_at, full_at, failed_since, last_error, register_mark, partial from sync_health',
  )
  return rows[0]
}

/**
 * The cache matches 1С now; `full` — a rebuild; `mark` — how far the register was read;
 * `failed` — the sets taken from their last copy or skipped this run, if any.
 */
export async function recordSuccess(
  db: Db,
  full: boolean,
  mark: string | null,
  failed: SetFailure[] = [],
): Promise<void> {
  await db.query(
    `update sync_health set synced_at = now(),
       full_at = case when $1 then now() else full_at end,
       failed_since = null, last_error = null,
       register_mark = greatest(register_mark, $2), partial = $3::jsonb`,
    [full, mark, failed.length ? JSON.stringify(failed) : null],
  )
}

/** 1С did not answer (or answered wrong): the cache stays as it was; the first failure is kept. */
export async function recordFailure(db: Db, error: unknown): Promise<void> {
  await db.query(
    `update sync_health set failed_since = coalesce(failed_since, now()), last_error = $1`,
    [error instanceof Error ? error.message : String(error)],
  )
}

/** What the header shows: how fresh the cache is, and whether 1С answers. */
export async function syncStatus(
  db: Db,
  running: boolean,
): Promise<SyncStatus & { partial: string[] }> {
  const h = await readHealth(db)
  return {
    // Names only: 1С's answers stay in the database, not in what the browser gets.
    partial: (h.partial ?? []).map((f) => f.entity),
    syncedAt: h.synced_at?.toISOString() ?? null,
    unavailableSince: h.failed_since?.toISOString() ?? null,
    running,
  }
}
