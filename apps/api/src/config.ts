import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  /** Browser origins allowed to call the API, comma-separated */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ODATA_URL: z.url(),
  ODATA_USER: z.string().min(1),
  ODATA_PASSWORD: z.string().min(1),
  ODATA_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /**
   * The 1С HTTP service that turns a request into «Заказ клиента»
   * (docs/1c/request-api.md). Unset: requests wait in the queue.
   */
  ONEC_ORDERS_URL: z.url().optional(),
  /** Its own 1С user, with rights to that service only */
  ONEC_ORDERS_USER: z.string().optional(),
  ONEC_ORDERS_PASSWORD: z.string().optional(),
  /** How often the queue is sent, ms */
  OUTBOX_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  /** The sync worker (Д26) in the API process; off for a second instance or a local run without 1С */
  SYNC_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** Between checks of 1С for changes, ms */
  SYNC_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 60_000),
  /** The local hour of the nightly full rebuild */
  SYNC_FULL_HOUR: z.coerce.number().int().min(0).max(23).default(3),
  /**
   * The customer's mail server (question 7), e.g. `smtps://user:password@host:465`.
   * Unset: no letters at all — digests and messages to the specialist wait.
   */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('РВД Кабинет <no-reply@localhost>'),
  /** Where «Связаться со специалистом» goes (question 15); unset — messages wait in the cabinet */
  SUPPORT_EMAIL: z.email().optional(),
  /** Local hour from which the day's notification digest goes out */
  NOTIFY_HOUR: z.coerce.number().int().min(0).max(23).default(7),
  /** The cabinet's address, for links in letters */
  CABINET_URL: z.url().optional(),
  /** Where uploaded files live (Д25), relative to the API's working directory or absolute */
  FILES_DIR: z.string().default('data/files'),
  /** ClamAV's clamd; unset — only the EICAR test file is caught, and the start says so */
  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  /** The path the browser reaches this API by (the dev proxy and the web server use /api) */
  PUBLIC_API_PATH: z.string().default('/api'),
  /**
   * The 1С client (Клиент_Key) whose data the cabinet shows while sign-in is
   * off; signed in, each company sees its own client (Д6–Д7).
   */
  CABINET_CLIENT_KEY: z.string().optional(),
  /** Signs access tokens; 32+ random characters. Without it the server will not start… */
  JWT_SECRET: z.string().min(32).optional(),
  /** …unless sign-in is switched off on purpose, for local runs: everyone is the demo user, secret or not. */
  AUTH_DISABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** The refresh cookie only over HTTPS; on wherever the cabinet is served over HTTPS */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

export type Config = z.infer<typeof schema>

/** Reads the environment once; a missing or malformed value stops the start with every problem named. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid configuration — ${problems}`)
  }
  return parsed.data
}
