import { buildApp, DEMO_IDENTITY } from './app.ts'
import { loadConfig } from './config.ts'
import { migrate } from './db/migrate.ts'
import { createPool } from './db/pool.ts'
import { purgeDrafts } from './files/attachments.ts'
import { clamav, diskStore, eicarOnly } from './files/storage.ts'
import { smtpMailer, startMail } from './mail/mail.ts'
import { ODataClient } from './onec/client.ts'
import { HttpOrderService } from './onec/orders.ts'
import { startOutbox } from './requests/outbox.ts'
import { startSync, type SyncScheduler } from './sync/scheduler.ts'

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
// Files (Д25) on disk; every upload checked by ClamAV when it is configured.
const files = diskStore(config.FILES_DIR)
const scan = config.CLAMAV_HOST ? clamav(config.CLAMAV_HOST, config.CLAMAV_PORT) : eicarOnly
// Requests go to 1С through its order service; without one configured they wait in the queue.
let outbox: { kick: () => void } | null = null
let sync: SyncScheduler | null = null
// Letters (question 7): one sender for invitations, digests and messages to the specialist.
const mailer = config.SMTP_URL ? smtpMailer(config.SMTP_URL, config.MAIL_FROM) : null
const app = buildApp({
  logLevel: config.LOG_LEVEL,
  db,
  trustProxy: config.TRUST_PROXY,
  corsOrigins: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
  auth: secret ? { secret, secureCookie: config.COOKIE_SECURE } : { demo: DEMO_IDENTITY },
  requests: { clientKey: config.CABINET_CLIENT_KEY, onCreated: () => outbox?.kick() },
  sync: { kick: () => sync?.kick(), running: () => sync?.running() ?? false },
  files: { store: files, scan, publicPath: config.PUBLIC_API_PATH },
  // Invitations need the cabinet's address for their links; without it, one-time passwords.
  mail:
    mailer && config.CABINET_URL
      ? { send: mailer.send, cabinetUrl: config.CABINET_URL }
      : undefined,
})
if (!config.CLAMAV_HOST)
  app.log.warn('ClamAV не задан (CLAMAV_HOST): из вредоносных файлов ловится только тестовый EICAR')
// Drafts a request form never claimed go after a day.
setInterval(
  () => void purgeDrafts(db, files).catch((error) => app.log.error({ err: error }, 'черновики')),
  60 * 60_000,
)
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
// Letters (Д19, question 7): only with the customer's SMTP; without it nothing is sent or marked sent.
if (mailer)
  startMail(db, mailer, {
    intervalMs: 60_000,
    supportTo: config.SUPPORT_EMAIL,
    dataIssuesTo: config.DATA_ISSUES_EMAIL,
    digestHour: config.NOTIFY_HOUR,
    cabinetUrl: config.CABINET_URL,
    onError: (error) => app.log.error({ err: error }, 'почта не отправлена'),
  })
// The cache follows 1С (Д26): a check every few minutes, a full rebuild at night.
if (config.SYNC_ENABLED) {
  const onec = new ODataClient({
    baseUrl: config.ODATA_URL,
    user: config.ODATA_USER,
    password: config.ODATA_PASSWORD,
    timeoutMs: config.ODATA_TIMEOUT_MS,
  })
  sync = startSync(db, onec, {
    intervalMs: config.SYNC_INTERVAL_MS,
    fullHour: config.SYNC_FULL_HOUR,
    // The full-cycle demo (Д20) reads request statuses from the stand-in; production, from 1С.
    states: config.ONEC_ORDER_STATES_URL
      ? new ODataClient({
          baseUrl: config.ONEC_ORDER_STATES_URL,
          user: config.ODATA_USER,
          password: config.ODATA_PASSWORD,
          timeoutMs: config.ODATA_TIMEOUT_MS,
        })
      : undefined,
    onRun: (r) => app.log.info({ sync: r }, 'синхронизация с 1С'),
    onError: (error) => app.log.error({ err: error }, '1С недоступна, данные — из кэша'),
  })
}

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
