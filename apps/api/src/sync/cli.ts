import { loadConfig } from '../config.ts'
import { migrate } from '../db/migrate.ts'
import { createPool } from '../db/pool.ts'
import { ODataClient } from '../onec/client.ts'
import { runSync } from './sync.ts'

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
const result = await runSync(db, client)
console.log(
  `synced ${result.products} products and ${result.equipment} machines in ${(result.ms / 1000).toFixed(1)}s`,
)
await db.end()
