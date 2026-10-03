import { buildApp, DEMO_IDENTITY } from './app.ts'
import { loadConfig } from './config.ts'
import { migrate } from './db/migrate.ts'
import { createPool } from './db/pool.ts'
import { HttpOrderService } from './onec/orders.ts'
import { startOutbox } from './requests/outbox.ts'

const config = loadConfig()
// No signing secret means anyone could read any client's data: refuse, unless switched off on purpose.
if (!config.JWT_SECRET && !config.AUTH_DISABLED)
  throw new Error(
    'Задайте JWT_SECRET (32+ случайных символа) или AUTH_DISABLED=true для локальной разработки',
  )
// Switched off on purpose, sign-in stays off even with a secret in the environment.
const secret = config.AUTH_DISABLED ? undefined : config.JWT_SECRET
const db = createPool(config.DATABASE_URL)
await migrate(db)
// Requests go to 1С through its order service; without one configured they wait in the queue.
let outbox: { kick: () => void } | null = null
const app = buildApp({
  logLevel: config.LOG_LEVEL,
  db,
  corsOrigins: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
  auth: secret
    ? { secret, secureCookie: config.COOKIE_SECURE }
    : { demo: { ...DEMO_IDENTITY, clientKey: config.CABINET_CLIENT_KEY ?? '' } },
  requests: { clientKey: config.CABINET_CLIENT_KEY, onCreated: () => outbox?.kick() },
})
if (!secret)
  app.log.warn('Вход выключен (AUTH_DISABLED=true): все видят данные как демо-пользователь')
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
