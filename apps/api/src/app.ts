import cors from '@fastify/cors'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { DEFAULT_RULES, ProductListQuery } from '@rvd/contracts'
import {
  login,
  logout,
  readAccess,
  refresh,
  REFRESH_DAYS,
  signedIn,
  type Identity,
} from './auth/service.ts'
import type { Db } from './db/pool.ts'
import { dashboardSummary } from './dashboard/query.ts'
import { equipmentProducts, getEquipment, listEquipment } from './equipment/query.ts'
import { productLifetime } from './products/lifetime.ts'
import { getProduct, listProducts, type Clock } from './products/query.ts'
import {
  createRequest,
  listRequests,
  RequestRejected,
  type RequestInput,
} from './requests/store.ts'

declare module 'fastify' {
  interface FastifyRequest {
    /** Who is asking; set by the sign-in check, or the demo user when sign-in is off */
    identity: Identity | null
  }
}

export interface AppOptions {
  logLevel?: string
  /** The cache; without it only `/health` answers (enough for config checks) */
  db?: Db
  /** Browser origins allowed to call the API */
  corsOrigins?: string[]
  /** Today and the status rules; the rules will come from the company settings */
  clock?: () => Clock
  /**
   * Sign-in (Д6–Д7). With a `secret` every route but `/health` and `/auth/*`
   * needs an access token, and a company sees only its own 1С client. Without
   * one sign-in is off: everyone is `demo`, and the data is the configured
   * client's (`requests.clientKey`) or everyone's.
   */
  auth?: { secret?: string; secureCookie?: boolean; demo?: Identity }
  requests?: {
    /** The 1С client a cabinet without sign-in stands for */
    clientKey?: string
    /** Called after a request is stored, to send the queue to 1С at once */
    onCreated?: () => void
  }
}

const localToday = () => new Date().toLocaleDateString('sv-SE')

const REFRESH_COOKIE = 'rvd_refresh'

export const DEMO_IDENTITY: Identity = {
  userId: 'demo',
  name: 'Пользователь кабинета (демо)',
  email: 'demo@localhost',
  role: 'engineer',
  companyId: 'demo',
  companyName: 'Демо-клиент',
  clientKey: '',
}

const cookieOf = (req: FastifyRequest, name: string) =>
  (req.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1]

/** The HTTP app without a listener, so tests can drive it with `inject`. */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info' } })
  const { db } = options
  const clock = options.clock ?? (() => ({ today: localToday(), rules: DEFAULT_RULES }))
  const secret = options.auth?.secret
  const demo = options.auth?.demo ?? DEMO_IDENTITY

  if (options.corsOrigins?.length)
    void app.register(cors, { origin: options.corsOrigins, credentials: true })

  app.decorateRequest('identity', null)
  app.addHook('onRequest', async (req, reply) => {
    if (!secret) {
      req.identity = demo
      return
    }
    const path = req.url.split('?')[0]
    if (path === '/health' || path.startsWith('/auth/')) return
    const header = req.headers.authorization
    req.identity = header?.startsWith('Bearer ') ? readAccess(header.slice(7), secret) : null
    if (!req.identity) return reply.code(401).send({ message: 'Требуется вход' })
  })

  /** Whose data this request may see: the company's 1С client, or the configured one without sign-in. */
  const clientOf = (req: FastifyRequest): string | undefined =>
    (secret ? req.identity?.clientKey : options.requests?.clientKey) || undefined

  const setRefresh = (reply: FastifyReply, token: string | null) =>
    reply.header(
      'set-cookie',
      `${REFRESH_COOKIE}=${token ?? ''}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${
        token ? REFRESH_DAYS * 86_400 : 0
      }${options.auth?.secureCookie ? '; Secure' : ''}`,
    )

  app.get('/health', async () => ({ status: 'ok', uptime: Math.round(process.uptime()) }))

  if (db) {
    // Sign-in: a short access token in the answer, a long refresh token in an httpOnly cookie.
    app.post<{ Body: { email?: string; password?: string } }>('/auth/login', async (req, reply) => {
      if (!secret) return signedIn(demo, '')
      const result = await login(
        db,
        secret,
        String(req.body?.email ?? ''),
        String(req.body?.password ?? ''),
      )
      if (!result) return reply.code(401).send({ message: 'Неверный логин или пароль' })
      setRefresh(reply, result.refreshToken)
      return signedIn(result.identity, result.accessToken)
    })

    app.post('/auth/refresh', async (req, reply) => {
      if (!secret) return signedIn(demo, '')
      const token = cookieOf(req, REFRESH_COOKIE)
      const result = token ? await refresh(db, secret, token) : null
      if (!result) {
        setRefresh(reply, null)
        return reply.code(401).send({ message: 'Требуется вход' })
      }
      // A request that raced a rotation gets no new token: the cookie the winner set stays.
      if (result.refreshToken) setRefresh(reply, result.refreshToken)
      return signedIn(result.identity, result.accessToken)
    })

    app.post('/auth/logout', async (req, reply) => {
      const token = cookieOf(req, REFRESH_COOKIE)
      if (secret && token) await logout(db, token)
      setRefresh(reply, null)
      return reply.code(204).send()
    })

    app.get('/me', async (req) => {
      const { user, company } = signedIn(req.identity ?? demo, '')
      return { user, company }
    })

    app.get('/products', async (req, reply) => {
      const query = ProductListQuery.safeParse(req.query)
      if (!query.success)
        return reply.code(400).send({ error: 'Bad query', issues: query.error.issues })
      // Signed in, the company's client wins over whatever the query asks for.
      const client = secret ? clientOf(req) : (query.data.client ?? clientOf(req))
      return listProducts(db, { ...query.data, client }, clock())
    })

    app.get<{ Params: { id: string } }>('/products/:id', async (req, reply) => {
      const product = await getProduct(db, req.params.id, clock(), clientOf(req))
      return product ?? reply.code(404).send({ error: 'Not found' })
    })

    app.get<{ Params: { id: string } }>('/products/:id/lifetime', async (req, reply) => {
      const c = clock()
      const product = await getProduct(db, req.params.id, c, clientOf(req))
      if (!product) return reply.code(404).send({ error: 'Not found' })
      // A plain `null` is a valid answer: no dates, no timeline.
      return reply.type('application/json').send(JSON.stringify(productLifetime(product, c.rules)))
    })

    // «История ЖЦ»: the hose's lines in 1С's statuses register, as the last sync stored them.
    app.get<{ Params: { id: string } }>('/products/:id/history', async (req, reply) => {
      const { rows } = await db.query<{ records: unknown[] | null }>(
        `select h.records from products p
           left join product_history h on h.product_id = p.id
          where p.id = $1 and ($2::text is null or p.client_id = $2)`,
        [req.params.id, clientOf(req) ?? null],
      )
      if (!rows.length) return reply.code(404).send({ error: 'Not found' })
      return rows[0].records ?? []
    })

    app.get('/equipment', async (req) => listEquipment(db, clock(), clientOf(req)))

    app.get<{ Params: { id: string } }>('/equipment/:id', async (req, reply) => {
      const machine = await getEquipment(db, req.params.id, clock(), clientOf(req))
      return machine ?? reply.code(404).send({ error: 'Not found' })
    })

    app.get<{ Params: { id: string } }>('/equipment/:id/products', async (req) =>
      equipmentProducts(db, req.params.id, clock(), clientOf(req)),
    )

    // Replacements come from 1С with Д16; until then a machine has none to show.
    app.get('/equipment/:id/replacements', async () => [])

    app.get('/dashboard/summary', async (req) => dashboardSummary(db, clock(), clientOf(req)))

    // Requests (Д18): taken here, sent to 1С by the outbox, statuses read back at sync.
    app.get('/requests', async (req) => listRequests(db, clientOf(req)))

    app.post<{ Body: RequestInput }>('/requests', async (req, reply) => {
      const who = req.identity ?? demo
      try {
        const created = await createRequest(db, req.body ?? ({} as RequestInput), {
          clientKey: clientOf(req),
          actor: { name: who.name, email: who.email },
        })
        options.requests?.onCreated?.()
        return reply.code(201).send(created)
      } catch (error) {
        if (error instanceof RequestRejected)
          return reply.code(400).send({ message: error.message })
        throw error
      }
    })

    app.get(
      '/sync/status',
      async () =>
        (await db.query('select entity, synced_at, rows, duration_ms from sync_state')).rows,
    )
  }

  return app
}
