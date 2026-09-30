import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { migrate } from './db/migrate.ts'
import { createPool } from './db/pool.ts'

const config = loadConfig()
const db = createPool(config.DATABASE_URL)
await migrate(db)
const app = buildApp({ logLevel: config.LOG_LEVEL, db })

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
