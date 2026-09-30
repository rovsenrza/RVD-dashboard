import { randomUUID } from 'node:crypto'
import { migrate } from '../db/migrate.ts'
import { createPool, type Db } from '../db/pool.ts'

/** Tests that need Postgres run only when TEST_DATABASE_URL is set (CI sets it; locally `docker compose up -d db`). */
export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL

export const hasDb = Boolean(TEST_DB_URL)

/** A pool on a schema of its own, migrated fresh; `drop` removes it. */
export async function isolatedDb(): Promise<{ db: Db; drop: () => Promise<void> }> {
  const schema = `t_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = createPool(TEST_DB_URL!)
  await admin.query(`create schema ${schema}`)
  const db = createPool(TEST_DB_URL!, schema)
  await migrate(db)
  return {
    db,
    drop: async () => {
      await db.end()
      await admin.query(`drop schema ${schema} cascade`)
      await admin.end()
    },
  }
}
