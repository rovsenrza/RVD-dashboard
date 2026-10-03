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
  /**
   * The 1С client (Клиент_Key) this cabinet stands for, until login ties each
   * company to its client (Д6–Д7).
   */
  CABINET_CLIENT_KEY: z.string().optional(),
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
