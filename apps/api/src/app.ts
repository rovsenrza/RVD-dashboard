import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import { DEFAULT_RULES, ProductListQuery } from '@rvd/contracts'
import type { Db } from './db/pool.ts'
import { productLifetime } from './products/lifetime.ts'
import { getProduct, listProducts, type Clock } from './products/query.ts'

export interface AppOptions {
  logLevel?: string
  /** The cache; without it only `/health` answers (enough for config checks) */
  db?: Db
  /** Browser origins allowed to call the API */
  corsOrigins?: string[]
  /** Today and the status rules; the rules will come from the company settings */
  clock?: () => Clock
}

const localToday = () => new Date().toLocaleDateString('sv-SE')

/** The HTTP app without a listener, so tests can drive it with `inject`. */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info' } })
  const { db } = options
  const clock = options.clock ?? (() => ({ today: localToday(), rules: DEFAULT_RULES }))

  if (options.corsOrigins?.length) void app.register(cors, { origin: options.corsOrigins })

  app.get('/health', async () => ({ status: 'ok', uptime: Math.round(process.uptime()) }))

  if (db) {
    app.get('/products', async (req, reply) => {
      const query = ProductListQuery.safeParse(req.query)
      if (!query.success)
        return reply.code(400).send({ error: 'Bad query', issues: query.error.issues })
      return listProducts(db, query.data, clock())
    })

    app.get<{ Params: { id: string } }>('/products/:id', async (req, reply) => {
      const product = await getProduct(db, req.params.id, clock())
      return product ?? reply.code(404).send({ error: 'Not found' })
    })

    app.get<{ Params: { id: string } }>('/products/:id/lifetime', async (req, reply) => {
      const c = clock()
      const product = await getProduct(db, req.params.id, c)
      if (!product) return reply.code(404).send({ error: 'Not found' })
      // A plain `null` is a valid answer: no dates, no timeline.
      return reply.type('application/json').send(JSON.stringify(productLifetime(product, c.rules)))
    })

    // «История ЖЦ»: the hose's lines in 1С's statuses register, as the last sync stored them.
    app.get<{ Params: { id: string } }>('/products/:id/history', async (req, reply) => {
      const { rows } = await db.query<{ records: unknown[] | null }>(
        `select h.records from products p
           left join product_history h on h.product_id = p.id
          where p.id = $1`,
        [req.params.id],
      )
      if (!rows.length) return reply.code(404).send({ error: 'Not found' })
      return rows[0].records ?? []
    })

    app.get(
      '/sync/status',
      async () =>
        (await db.query('select entity, synced_at, rows, duration_ms from sync_state')).rows,
    )
  }

  return app
}
