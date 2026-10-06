import cors from '@fastify/cors'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import {
  auditChanges,
  DEFAULT_RULES,
  DEFAULT_SETTINGS,
  ProductListQuery,
  requestChanges,
  settingsPatch,
  settingsView,
  userView,
  type PasswordDelivery,
  type UserCreated,
  type UserRole,
} from '@rvd/contracts'
import { hoseLabels, listAudit, recordAudit, type AuditNote } from './admin/audit.ts'
import { companySettings, saveSettings } from './admin/settings.ts'
import {
  listNotifications,
  markRead,
  notificationPrefs,
  saveNotificationPrefs,
  type Prefs,
} from './notifications/query.ts'
import {
  AuthRejected,
  changePassword,
  login,
  logout,
  readAccess,
  refresh,
  REFRESH_DAYS,
  signedIn,
  type Identity,
} from './auth/service.ts'
import {
  createUser,
  getUser,
  listUsers,
  resetPassword,
  updateUser,
  type UserDraft,
} from './auth/users.ts'
import type { Db } from './db/pool.ts'
import { dashboardSummary } from './dashboard/query.ts'
import { equipmentProducts, getEquipment, listEquipment } from './equipment/query.ts'
import { productLifetime } from './products/lifetime.ts'
import { getProduct, listProducts, type Clock } from './products/query.ts'
import { listReplacements } from './replacements/query.ts'
import { syncStatus } from './sync/health.ts'
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
  /** Today and the default status rules; a signed-in company's own settings override the rules */
  clock?: () => Clock
  /**
   * Sign-in (Д6–Д7). With a `secret` every route but `/health` and getting a
   * session (login, refresh, logout) needs an access token, and a company sees
   * only its own 1С client. Without one sign-in is off: everyone is `demo`, and
   * the data is the configured client's (`requests.clientKey`) or everyone's.
   */
  auth?: { secret?: string; secureCookie?: boolean; demo?: Identity }
  requests?: {
    /** The 1С client a cabinet without sign-in stands for */
    clientKey?: string
    /** Called after a request is stored, to send the queue to 1С at once */
    onCreated?: () => void
  }
  /** The sync worker (Д26), when this process runs one */
  sync?: { kick: () => void; running: () => boolean }
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
  mustChangePassword: false,
}

const cookieOf = (req: FastifyRequest, name: string) =>
  (req.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1]

/** Routes anyone may call: the health check and getting a session. */
const OPEN = new Set(['/health', '/auth/login', '/auth/refresh', '/auth/logout'])
/** All a person signed in with an administrator's one-time password may do until they replace it. */
const WHILE_TEMPORARY = new Set(['/auth/password', '/me'])

/** The fields an administrator may send for a user, whatever else the body holds. */
const userFields = (body: unknown): Partial<UserDraft> & { active?: boolean } => {
  const b = (body ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v : undefined)
  return {
    name: text(b.name),
    email: text(b.email),
    role: text(b.role) as UserRole | undefined,
    active: typeof b.active === 'boolean' ? b.active : undefined,
  }
}

/** A refusal the person can act on goes back with its status and message; anything else is a fault. */
async function answering<T>(reply: FastifyReply, work: () => Promise<T>) {
  try {
    return await work()
  } catch (error) {
    if (error instanceof AuthRejected)
      return reply.code(error.status).send({ message: error.message })
    throw error
  }
}

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
    if (OPEN.has(path)) return
    const header = req.headers.authorization
    req.identity = header?.startsWith('Bearer ') ? readAccess(header.slice(7), secret) : null
    if (!req.identity) return reply.code(401).send({ message: 'Требуется вход' })
    // The administrator knows a one-time password: no data until the person sets their own.
    if (req.identity.mustChangePassword && !WHILE_TEMPORARY.has(path))
      return reply.code(403).send({ message: 'Смените пароль, выданный администратором' })
  })

  /** Whose data this request may see: the company's 1С client, or the configured one without sign-in. */
  const clientOf = (req: FastifyRequest): string | undefined =>
    (secret ? req.identity?.clientKey : options.requests?.clientKey) || undefined

  /** Today and the asking company's «Внимание» rule (Д22); without sign-in, the defaults. */
  const clockOf = async (req: FastifyRequest): Promise<Clock> => {
    const today = clock()
    if (!db || !secret || !req.identity) return today
    const { warnRule, warnPercent, warnDays } = await companySettings(db, req.identity.companyId)
    return { ...today, rules: { warnRule, warnPercent, warnDays } }
  }

  /** The action log (Д23) belongs to a signed-in company; a cabinet without sign-in keeps none. */
  const audit = async (req: FastifyRequest, note: AuditNote) => {
    if (db && secret && req.identity) await recordAudit(db, req.identity, note)
  }

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
      const { user, company, mustChangePassword } = signedIn(req.identity ?? demo, '')
      return { user, company, mustChangePassword }
    })

    // One's own password: every other sign-in ends, this one goes on with fresh tokens.
    app.post<{ Body: { current?: unknown; next?: unknown } }>(
      '/auth/password',
      async (req, reply) => {
        if (!secret || !req.identity)
          return reply.code(404).send({ message: 'Вход в этом кабинете выключен' })
        const identity = req.identity
        return answering(reply, async () => {
          const result = await changePassword(db, secret, identity.userId, {
            current: String(req.body?.current ?? ''),
            next: String(req.body?.next ?? ''),
          })
          setRefresh(reply, result.refreshToken)
          return signedIn(result.identity, result.accessToken)
        })
      },
    )

    // The company's users (Д6): the administrator's, and only within their own company.
    void app.register(async (admin) => {
      admin.addHook('preHandler', async (req, reply) => {
        if (!secret || req.identity?.role !== 'admin')
          return reply.code(403).send({ message: 'Раздел для администратора' })
      })
      const companyOf = (req: FastifyRequest) => req.identity!.companyId

      admin.get('/admin/users', async (req) => listUsers(db, companyOf(req)))

      admin.post('/admin/users', async (req, reply) =>
        answering(reply, async () => {
          const { user, password } = await createUser(
            db,
            companyOf(req),
            userFields(req.body) as UserDraft,
          )
          await audit(req, {
            action: 'user.create',
            target: { kind: 'user', id: user.id, label: user.name },
            changes: auditChanges({}, userView(user)),
          })
          // No mail server yet: the administrator passes the one-time password on.
          const created: UserCreated = { user, delivery: { kind: 'password', password } }
          return reply.code(201).send(created)
        }),
      )

      admin.patch<{ Params: { id: string } }>('/admin/users/:id', async (req, reply) =>
        answering(reply, async () => {
          const before = await getUser(db, companyOf(req), req.params.id)
          const user = await updateUser(
            db,
            companyOf(req),
            req.identity!.userId,
            req.params.id,
            userFields(req.body),
          )
          const changes = auditChanges(userView(before), userView(user))
          // Access switched on or off alone reads as its own action, as in the demo.
          const onlyAccess = changes.length === 1 && changes[0].field === 'Доступ'
          if (changes.length)
            await audit(req, {
              action: onlyAccess
                ? user.active
                  ? 'user.activate'
                  : 'user.deactivate'
                : 'user.update',
              target: { kind: 'user', id: user.id, label: user.name },
              changes,
            })
          return user
        }),
      )

      admin.post<{ Params: { id: string } }>(
        '/admin/users/:id/reset-password',
        async (req, reply) =>
          answering(reply, async (): Promise<PasswordDelivery> => {
            const user = await getUser(db, companyOf(req), req.params.id)
            const password = await resetPassword(db, companyOf(req), req.params.id)
            await audit(req, {
              action: 'user.password',
              target: { kind: 'user', id: user.id, label: user.name },
              changes: [],
            })
            return { kind: 'password', password }
          }),
      )

      // Company settings (Д22): the «Внимание» rule every status is read by, lead days, channels.
      admin.get('/admin/settings', async (req) => companySettings(db, companyOf(req)))

      admin.patch('/admin/settings', async (req, reply) =>
        answering(reply, async () => {
          const { before, after } = await saveSettings(db, companyOf(req), settingsPatch(req.body))
          const changes = auditChanges(settingsView(before), settingsView(after))
          if (changes.length)
            await audit(req, {
              action: 'settings.update',
              target: { kind: 'settings', id: null, label: 'Настройки компании' },
              changes,
            })
          return after
        }),
      )

      // The action log (Д23): every change made in the company's cabinet, newest first.
      admin.get('/admin/audit', async (req) => listAudit(db, companyOf(req)))

      // «Обновить сейчас» (Д26): the next check runs at once; the header follows `GET /sync`.
      admin.post('/sync', async (_req, reply) => {
        if (!options.sync)
          return reply.code(503).send({ message: 'Синхронизация с 1С на этом сервере выключена' })
        options.sync.kick()
        return reply.code(202).send(await syncStatus(db, options.sync.running()))
      })
    })

    app.get('/products', async (req, reply) => {
      const query = ProductListQuery.safeParse(req.query)
      if (!query.success)
        return reply.code(400).send({ error: 'Bad query', issues: query.error.issues })
      // Signed in, the company's client wins over whatever the query asks for.
      const client = secret ? clientOf(req) : (query.data.client ?? clientOf(req))
      return listProducts(db, { ...query.data, client }, await clockOf(req))
    })

    app.get<{ Params: { id: string } }>('/products/:id', async (req, reply) => {
      const product = await getProduct(db, req.params.id, await clockOf(req), clientOf(req))
      return product ?? reply.code(404).send({ error: 'Not found' })
    })

    app.get<{ Params: { id: string } }>('/products/:id/lifetime', async (req, reply) => {
      const c = await clockOf(req)
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

    app.get('/equipment', async (req) => listEquipment(db, await clockOf(req), clientOf(req)))

    app.get<{ Params: { id: string } }>('/equipment/:id', async (req, reply) => {
      const machine = await getEquipment(db, req.params.id, await clockOf(req), clientOf(req))
      return machine ?? reply.code(404).send({ error: 'Not found' })
    })

    app.get<{ Params: { id: string } }>('/equipment/:id/products', async (req) =>
      equipmentProducts(db, req.params.id, await clockOf(req), clientOf(req)),
    )

    // «История замен» (Д16): swaps 1С recorded, read from the hose that names the one it replaced.
    app.get('/replacements', async (req) => listReplacements(db, { client: clientOf(req) }))

    app.get<{ Params: { id: string } }>('/products/:id/replacements', async (req) =>
      listReplacements(db, { client: clientOf(req), product: req.params.id }),
    )

    app.get<{ Params: { id: string } }>('/equipment/:id/replacements', async (req) =>
      listReplacements(db, { client: clientOf(req), equipment: req.params.id }),
    )

    app.get('/dashboard/summary', async (req) =>
      dashboardSummary(db, await clockOf(req), clientOf(req)),
    )

    // Notifications (Д19): worked out per person from the cache, the company's lead days and
    // their own choice; only reads and the choice are stored.
    const personOf = (req: FastifyRequest) => (secret && req.identity ? req.identity : null)
    const notices = async (req: FastifyRequest) => {
      const person = personOf(req)
      const settings = person ? await companySettings(db, person.companyId) : DEFAULT_SETTINGS
      const prefs = await notificationPrefs(db, person?.userId ?? null)
      return listNotifications(db, clock().today, {
        userId: person?.userId ?? null,
        client: clientOf(req),
        leadDays: settings.leadDays,
        kinds: prefs.kinds,
      })
    }
    const prefsView = async (req: FastifyRequest, prefs: Prefs) => {
      const person = personOf(req)
      const settings = person ? await companySettings(db, person.companyId) : DEFAULT_SETTINGS
      return { ...prefs, address: (person ?? demo).email, companyEmail: settings.channels.email }
    }

    app.get('/notifications', async (req) => notices(req))

    app.post<{ Body: { ids?: unknown } }>('/notifications/read', async (req) => {
      const person = personOf(req)
      const list = await notices(req)
      const asked = Array.isArray(req.body?.ids)
        ? new Set(req.body.ids.filter((id): id is string => typeof id === 'string'))
        : null
      // No ids — «Прочитать все»: everything this person sees now.
      const ids = list.filter((n) => !n.read && (!asked || asked.has(n.id))).map((n) => n.id)
      if (person && ids.length) await markRead(db, person.userId, ids)
      const done = new Set(person ? ids : [])
      return { unread: list.filter((n) => !n.read && !done.has(n.id)).length }
    })

    app.get('/me/notification-prefs', async (req) =>
      prefsView(req, await notificationPrefs(db, personOf(req)?.userId ?? null)),
    )

    app.patch<{ Body: Partial<Prefs> }>('/me/notification-prefs', async (req, reply) => {
      const person = personOf(req)
      if (!person) return reply.code(404).send({ message: 'Вход в этом кабинете выключен' })
      const body = req.body ?? {}
      return answering(reply, async () =>
        prefsView(
          req,
          await saveNotificationPrefs(db, person.userId, { kinds: body.kinds, email: body.email }),
        ),
      )
    })

    // Requests (Д18): taken here, sent to 1С by the outbox, statuses read back at sync.
    app.get('/requests', async (req) => listRequests(db, clientOf(req)))

    app.post<{ Body: RequestInput }>('/requests', async (req, reply) => {
      const who = req.identity ?? demo
      try {
        const created = await createRequest(db, req.body ?? ({} as RequestInput), {
          clientKey: clientOf(req),
          actor: { name: who.name, email: who.email },
        })
        await audit(req, {
          action: 'request.create',
          // The СВЦБ number comes from 1С later; the log keeps what was known at the time.
          target: { kind: 'request', id: created.id, label: created.number ?? 'Новая заявка' },
          changes: requestChanges(
            created,
            await hoseLabels(
              db,
              created.positions.map((l) => l.productId),
            ),
          ),
        })
        options.requests?.onCreated?.()
        return reply.code(201).send(created)
      } catch (error) {
        if (error instanceof RequestRejected)
          return reply.code(400).send({ message: error.message })
        throw error
      }
    })

    // How fresh the cache is (Д26): «данные на HH:MM», and whether 1С answers.
    app.get('/sync', async () => syncStatus(db, options.sync?.running() ?? false))

    app.get(
      '/sync/status',
      async () =>
        (await db.query('select entity, synced_at, rows, duration_ms from sync_state')).rows,
    )
  }

  return app
}
