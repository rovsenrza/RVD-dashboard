import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Db } from './pool.ts'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../migrations')

/** Applies the numbered .sql files that have not run yet, each in its own transaction. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  )
  const done = new Set(
    (await db.query<{ name: string }>('select name from schema_migrations')).rows.map(
      (r) => r.name,
    ),
  )
  const applied: string[] = []
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    const client = await db.connect()
    try {
      await client.query('begin')
      await client.query(await readFile(path.join(dir, file), 'utf8'))
      await client.query('insert into schema_migrations (name) values ($1)', [file])
      await client.query('commit')
      applied.push(file)
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }
  return applied
}
