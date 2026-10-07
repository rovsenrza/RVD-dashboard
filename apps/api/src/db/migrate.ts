import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Db } from './pool.ts'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../migrations')

/** The advisory lock one migration run holds in the whole database. */
const MIGRATE_LOCK = 72_766_401

/**
 * Applies the numbered .sql files that have not run yet, each in its own transaction. Runs take
 * turns database-wide: `create extension` is not per schema, so test suites migrating schemas of
 * their own side by side on a fresh database, or two API processes starting at once, would collide.
 */
export async function migrate(db: Db): Promise<string[]> {
  const client = await db.connect()
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATE_LOCK])
    await client.query(
      'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
    )
    const done = new Set(
      (await client.query<{ name: string }>('select name from schema_migrations')).rows.map(
        (r) => r.name,
      ),
    )
    const applied: string[] = []
    for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
      if (done.has(file)) continue
      try {
        await client.query('begin')
        await client.query(await readFile(path.join(dir, file), 'utf8'))
        await client.query('insert into schema_migrations (name) values ($1)', [file])
        await client.query('commit')
        applied.push(file)
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    }
    return applied
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATE_LOCK]).catch(() => {})
    client.release()
  }
}
