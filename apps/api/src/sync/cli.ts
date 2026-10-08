import { loadConfig } from '../config.ts'
import { migrate } from '../db/migrate.ts'
import { createPool } from '../db/pool.ts'
import { ODataClient } from '../onec/client.ts'
import { recordFailure } from './health.ts'
import { runCheck, runSync } from './sync.ts'

/** `npm run sync -w @rvd/api` rebuilds the cache; `-- --check` patches only what changed. */
const check = process.argv.includes('--check')
const config = loadConfig()
const db = createPool(config.DATABASE_URL)
await migrate(db)
const client = new ODataClient({
  baseUrl: config.ODATA_URL,
  user: config.ODATA_USER,
  password: config.ODATA_PASSWORD,
  timeoutMs: config.ODATA_TIMEOUT_MS,
  log: (e) => e.status !== 200 && console.warn('1С', e),
})
try {
  const r = check ? await runCheck(db, client) : await runSync(db, client)
  console.log(
    r.mode === 'full'
      ? `synced ${r.products} products and ${r.equipment} machines in ${(r.ms / 1000).toFixed(1)}s; ${r.discrepancies} data discrepancies in 1С`
      : `checked: ${r.refreshed} products read again, ${r.removed} removed in ${(r.ms / 1000).toFixed(1)}s`,
  )
} catch (error) {
  await recordFailure(db, error)
  throw error
} finally {
  await db.end()
}
