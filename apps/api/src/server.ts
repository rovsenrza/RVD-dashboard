import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { migrate } from './db/migrate.ts'
import { createPool } from './db/pool.ts'
import { HttpOrderService } from './onec/orders.ts'
import { startOutbox } from './requests/outbox.ts'

const config = loadConfig()
const db = createPool(config.DATABASE_URL)
await migrate(db)
// Requests go to 1С through its order service; without one configured they wait in the queue.
let outbox: { kick: () => void } | null = null
const app = buildApp({
  logLevel: config.LOG_LEVEL,
  db,
  corsOrigins: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
  requests: { clientKey: config.CABINET_CLIENT_KEY, onCreated: () => outbox?.kick() },
})
if (config.ONEC_ORDERS_URL) {
  const orders = new HttpOrderService({
    url: config.ONEC_ORDERS_URL,
    user: config.ONEC_ORDERS_USER,
    password: config.ONEC_ORDERS_PASSWORD,
    timeoutMs: config.ODATA_TIMEOUT_MS,
  })
  outbox = startOutbox(db, orders, config.OUTBOX_INTERVAL_MS, (error) => app.log.error(error))
}

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
