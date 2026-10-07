import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import {
  auditChanges,
  commentChange,
  equipmentView,
  SUPPORT_TOPIC_LABEL,
  supportChanges,
  type NewSupportMessage,
  type Product,
  DEFAULT_RULES,
  DEFAULT_SETTINGS,
  dashboardPeriod,
  filesChange,
  MAX_FILE_BYTES,
  ProductListQuery,
  requestChanges,
  settingsPatch,
  settingsView,
  userView,
  type PasswordDelivery,
  type UserCreated,
  type UserRole,
  WRONG_CURRENT_PASSWORD,
} from '@rvd/contracts'
import { hoseLabels, listAudit, recordAudit, type AuditNote } from './admin/audit.ts'
import { companySettings, saveSettings } from './admin/settings.ts'
import {
  addComment,
  createSupportMessage,
  deleteComment,
  editComment,
  listComments,
  saveEquipment,
  saveInstallation,
} from './cabinet/store.ts'
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
  acceptInvite,
  createInvite,
  inviteLetter,
  readInvite,
  type InviteKind,
} from './auth/invites.ts'
import { attemptLimiter, waitText, type Limiter } from './auth/limiter.ts'
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
import { companyModels, companyReport } from './reports/query.ts'
import { syncStatus } from './sync/health.ts'
import type { Mail } from './mail/mail.ts'
import { createFiles } from './files/attachments.ts'
import {
  eicarOnly,
  fileLinks,
  memoryStore,
  type FileStore,
  type FileVariant,
  type Scanner,
} from './files/storage.ts'
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
  auth?: {
    secret?: string
    secureCookie?: boolean
    demo?: Identity
    /** Wrong-password limits per account and per address (Д29); tests pass their own */
    limits?: { account?: Limiter; address?: Limiter }
  }
  requests?: {
    /** The 1С client a cabinet without sign-in stands for */
    clientKey?: string
    /** Called after a request is stored, to send the queue to 1С at once */
    onCreated?: () => void
  }
  /** The sync worker (Д26), when this process runs one */
  sync?: { kick: () => void; running: () => boolean }
  /** Letters (question 7): invitations go by mail when this is set, with links to `cabinetUrl` */
  mail?: { send: (mail: Mail) => Promise<void>; cabinetUrl: string }
  /** Behind a proxy: the visitor's address comes from X-Forwarded-For */
  trustProxy?: boolean
  /** Files (Д25): where bytes live, the antivirus, and the path the browser reaches the API by */
  files?: { store?: FileStore; scan?: Scanner; publicPath?: string }
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
const OPEN = new Set(['/health', '/auth/login', '/auth/refresh', '/auth/logout', '/auth/invite'])
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
  const app = Fastify({
    logger: { level: options.logLevel ?? 'info' },
    trustProxy: options.trustProxy ?? false,
  })
  const { db } = options
  const clock = options.clock ?? (() => ({ today: localToday(), rules: DEFAULT_RULES }))
  const secret = options.auth?.secret
  const demo = options.auth?.demo ?? DEMO_IDENTITY

  if (options.corsOrigins?.length)
    void app.register(cors, { origin: options.corsOrigins, credentials: true })
  void app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 5 } })
  const links = fileLinks(secret, options.files?.publicPath ?? '/api')
  const files = db
    ? createFiles(
        db,
        options.files?.store ?? memoryStore(),
        options.files?.scan ?? eicarOnly,
        links,
      )
    : (null as never)

  const accounts =
    options.auth?.limits?.account ?? attemptLimiter({ max: 5, windowMs: 15 * 60_000 })
  const addresses =
    options.auth?.limits?.address ?? attemptLimiter({ max: 20, windowMs: 15 * 60_000 })

  // Every answer (Д29): no sniffing, no framing, no referrer; data is never cached on the way.
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'no-referrer')
    if (!reply.hasHeader('Cache-Control')) reply.header('Cache-Control', 'no-store')
  })

  app.decorateRequest('identity', null)
  app.addHook('onRequest', async (req, reply) => {
    if (!secret) {
      req.identity = demo
      return
    }
    const path = req.url.split('?')[0]
    if (OPEN.has(path)) return
    // A file link the API signed carries its own permission: an <img> sends no token.
    const signed = path.match(/^\/attachments\/([^/]+)\/(file|preview)$/)
    if (signed) {
      const q = req.query as { exp?: unknown; sig?: unknown }
      if (links.valid(signed[1], signed[2] as FileVariant, q.exp, q.sig)) return
    }
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

  // For the monitor (Д31): the database must answer; 1С being away is degraded, not down — the
  // cabinet keeps serving its cache.
  app.get('/health', async (_req, reply) => {
    const uptime = Math.round(process.uptime())
    if (!db) return { status: 'ok', uptime }
    const sync = await syncStatus(db, options.sync?.running() ?? false).catch(() => null)
    if (!sync) return reply.code(503).send({ status: 'down', uptime, db: 'down' })
    return {
      status: sync.unavailableSince ? 'degraded' : 'ok',
      uptime,
      db: 'ok',
      syncedAt: sync.syncedAt,
      onecUnavailableSince: sync.unavailableSince,
    }
  })

  if (db) {
    // Sign-in: a short access token in the answer, a long refresh token in an httpOnly cookie.
    // Guessing (Д29): an account takes 5 wrong passwords in 15 minutes, an address 20.
    const tooMany = (reply: FastifyReply, seconds: number) =>
      reply
        .code(429)
        .header('Retry-After', String(seconds))
        .send({ message: waitText(seconds) })

    app.post<{ Body: { email?: string; password?: string } }>('/auth/login', async (req, reply) => {
      if (!secret) return signedIn(demo, '')
      const email = String(req.body?.email ?? '')
      const keys = [`account:${email.trim().toLowerCase()}`, `address:${req.ip}`]
      const wait = Math.max(accounts.wait(keys[0]), addresses.wait(keys[1]))
      if (wait) return tooMany(reply, wait)
      const result = await login(db, secret, email, String(req.body?.password ?? ''))
      if (!result) {
        accounts.fail(keys[0])
        addresses.fail(keys[1])
        return reply.code(401).send({ message: 'Неверный логин или пароль' })
      }
      accounts.clear(keys[0])
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

    // Setting one's password from an invitation link (with mail): who it is for, then the password.
    app.get<{ Querystring: { token?: string } }>('/auth/invite', async (req, reply) => {
      const invite = secret && req.query.token ? await readInvite(db, req.query.token) : null
      return invite
        ? { name: invite.name, email: invite.email }
        : reply.code(404).send({
            message:
              'Ссылка недействительна или устарела — попросите администратора прислать новую',
          })
    })

    app.post<{ Body: { token?: unknown; password?: unknown } }>(
      '/auth/invite',
      async (req, reply) => {
        if (!secret) return reply.code(404).send({ message: 'Вход в этом кабинете выключен' })
        return answering(reply, async () => {
          const result = await acceptInvite(
            db,
            secret,
            String(req.body?.token ?? ''),
            String(req.body?.password ?? ''),
          )
          setRefresh(reply, result.refreshToken)
          return signedIn(result.identity, result.accessToken)
        })
      },
    )

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
        // A stolen session must not guess the current password either.
        const key = `account:${identity.email.toLowerCase()}`
        const wait = accounts.wait(key)
        if (wait) return tooMany(reply, wait)
        return answering(reply, async () => {
          const result = await changePassword(db, secret, identity.userId, {
            current: String(req.body?.current ?? ''),
            next: String(req.body?.next ?? ''),
          }).catch((error: unknown) => {
            if (error instanceof AuthRejected && error.message === WRONG_CURRENT_PASSWORD)
              accounts.fail(key)
            throw error
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

      /**
       * How a new or reset password reaches the person: by mail, a link to set their own
       * (when SMTP and the cabinet's address are known); otherwise — or if the letter
       * fails — the one-time password, shown once to the administrator.
       */
      const deliver = async (
        req: FastifyRequest,
        user: { id: string; name: string; email: string },
        kind: InviteKind,
        password: string,
      ): Promise<PasswordDelivery> => {
        const mail = options.mail
        if (!mail) return { kind: 'password', password }
        try {
          const token = await createInvite(db, user.id)
          const link = `${mail.cabinetUrl.replace(/\/+$/, '')}/invite?token=${token}`
          await mail.send(inviteLetter(kind, { ...user, company: req.identity!.companyName }, link))
          return { kind: 'email', sentTo: user.email }
        } catch (error) {
          req.log.error({ err: error }, 'приглашение не отправлено')
          return { kind: 'password', password }
        }
      }

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
          // With mail, a link to set their own password; without, the one-time password.
          const delivery = await deliver(req, user, 'welcome', password)
          const created: UserCreated = { user, delivery }
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
            return deliver(req, user, 'reset', password)
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

    // What the customer alone knows (Д11–Д12): where a hose sits, its own number, notes, messages.
    const scopeOf = async (req: FastifyRequest) => ({
      client: clientOf(req),
      clock: await clockOf(req),
    })
    const hoseTarget = (p: Product) => ({
      kind: 'product' as const,
      id: p.id,
      label: `EHS ${p.serialNumber}`,
    })
    const localView = (p: Product) => ({
      'Место установки': p.installPlace,
      'Внутренний №': p.clientNumber,
    })

    app.patch<{ Params: { id: string } }>('/products/:id', async (req, reply) =>
      answering(reply, async () => {
        const body = (req.body ?? {}) as Record<string, unknown>
        const { before, after } = await saveInstallation(
          db,
          req.params.id,
          body,
          await scopeOf(req),
        )
        const changes = auditChanges(localView(before), localView(after))
        if (changes.length)
          await audit(req, { action: 'installation.update', target: hoseTarget(after), changes })
        return after
      }),
    )

    app.patch<{ Params: { id: string } }>('/equipment/:id', async (req, reply) =>
      answering(reply, async () => {
        const body = (req.body ?? {}) as Record<string, unknown>
        const { before, after } = await saveEquipment(db, req.params.id, body, await scopeOf(req))
        const changes = auditChanges(equipmentView(before), equipmentView(after))
        if (changes.length)
          await audit(req, {
            action: 'equipment.update',
            target: { kind: 'equipment', id: after.id, label: after.garageNumber },
            changes,
          })
        return after
      }),
    )

    app.get<{ Params: { id: string } }>('/products/:id/comments', async (req, reply) =>
      answering(reply, async () => listComments(db, req.params.id, await scopeOf(req))),
    )

    app.post<{ Params: { id: string }; Body: { text?: unknown } }>(
      '/products/:id/comments',
      async (req, reply) =>
        answering(reply, async () => {
          const { comment, product } = await addComment(
            db,
            req.params.id,
            req.body?.text,
            req.identity ?? demo,
            await scopeOf(req),
          )
          await audit(req, {
            action: 'comment.create',
            target: hoseTarget(product),
            changes: commentChange(null, comment.text),
          })
          return reply.code(201).send(comment)
        }),
    )

    app.patch<{ Params: { id: string }; Body: { text?: unknown } }>(
      '/comments/:id',
      async (req, reply) =>
        answering(reply, async () => {
          const { before, comment, product } = await editComment(
            db,
            req.params.id,
            req.body?.text,
            req.identity ?? demo,
            await scopeOf(req),
          )
          if (before !== comment.text)
            await audit(req, {
              action: 'comment.update',
              target: hoseTarget(product),
              changes: commentChange(before, comment.text),
            })
          return comment
        }),
    )

    app.delete<{ Params: { id: string } }>('/comments/:id', async (req, reply) =>
      answering(reply, async () => {
        const { text, product } = await deleteComment(
          db,
          req.params.id,
          req.identity ?? demo,
          await scopeOf(req),
        )
        await audit(req, {
          action: 'comment.delete',
          target: hoseTarget(product),
          changes: commentChange(text, null),
        })
        return reply.code(204).send()
      }),
    )

    app.post<{ Body: Partial<NewSupportMessage> }>('/support/messages', async (req, reply) =>
      answering(reply, async () => {
        const { message, product } = await createSupportMessage(
          db,
          req.body ?? {},
          req.identity ?? demo,
          await scopeOf(req),
        )
        await audit(req, {
          action: 'support.message',
          target: product
            ? hoseTarget(product)
            : { kind: 'message', id: message.id, label: SUPPORT_TOPIC_LABEL[message.topic] },
          changes: supportChanges(message, product?.installedAt ?? product?.shippedAt ?? null),
        })
        return reply.code(201).send(message)
      }),
    )

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

    app.get<{ Querystring: { days?: string } }>('/dashboard/summary', async (req) =>
      dashboardSummary(db, await clockOf(req), clientOf(req), dashboardPeriod(req.query.days)),
    )

    // Reports (Д21) and the model comparison (Д15): the manager's and the administrator's.
    const forManagers = async (req: FastifyRequest, reply: FastifyReply) => {
      if (secret && req.identity?.role !== 'manager' && req.identity?.role !== 'admin')
        return reply.code(403).send({ message: 'Раздел для руководителя и администратора' })
    }

    app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
      '/reports/:id',
      { preHandler: forManagers },
      async (req, reply) => {
        const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
        const report = await companyReport(db, req.params.id, await clockOf(req), {
          client: clientOf(req),
          companyName: (req.identity ?? demo).companyName,
          from: day(req.query.from),
          to: day(req.query.to),
        })
        return report ?? reply.code(404).send({ message: 'Нет такого отчёта' })
      },
    )

    // The supplier's catalogue numbers: suggestions in the request form, a filter in the registry.
    app.get('/catalog-numbers', async () =>
      (
        await db.query<{ data: unknown }>(
          `select data from catalog_numbers order by length(name), name`,
        )
      ).rows.map((r) => r.data),
    )

    // Technical documentation lives in 1С's file storage, which OData does not publish yet:
    // an honest empty list rather than the demo's sample.
    app.get<{ Params: { id: string } }>('/products/:id/documentation', async (req, reply) =>
      (await getProduct(db, req.params.id, await clockOf(req), clientOf(req)))
        ? []
        : reply.code(404).send({ message: 'Изделие не найдено' }),
    )

    app.get('/analytics/models', { preHandler: forManagers }, async (req) =>
      companyModels(db, await clockOf(req), clientOf(req)),
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
        inspectionDays: settings.inspectionDays,
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
    app.get('/requests', async (req) => {
      const list = await listRequests(db, clientOf(req))
      const attached = await files.ofRequests(list.map((r) => r.id))
      return list.map((r) => ({ ...r, attachments: attached.get(r.id) ?? [] }))
    })

    app.post<{ Body: RequestInput }>('/requests', async (req, reply) => {
      const who = req.identity ?? demo
      const body = req.body ?? ({} as RequestInput)
      // Only the asker's own unclaimed uploads join; their real names decide the «Excel» rule.
      const drafts = await files.drafts(body.attachmentIds, who.userId)
      try {
        const request = await createRequest(
          db,
          {
            ...body,
            attachmentIds: drafts.map((d) => d.id),
            attachmentNames: drafts.map((d) => d.fileName),
          },
          { clientKey: clientOf(req), actor: { name: who.name, email: who.email } },
        )
        const created = {
          ...request,
          attachments: await files.claim(
            drafts.map((d) => d.id),
            { kind: 'request', id: request.id },
          ),
        }
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

    // Files (Д25): a hose takes them at once; a request form uploads drafts and claims them.
    app.post('/attachments', async (req, reply) =>
      answering(reply, async () => {
        let upload: { fileName: string; data: Buffer } | null = null
        const fields: Record<string, string> = {}
        try {
          for await (const part of req.parts())
            if (part.type === 'file')
              upload = { fileName: part.filename, data: await part.toBuffer() }
            else fields[part.fieldname] = String(part.value)
        } catch {
          throw new AuthRejected(422, `Файл больше ${MAX_FILE_BYTES / 1024 / 1024} МБ`)
        }
        if (!upload) throw new AuthRejected(400, 'Файл не передан')
        const { attachment, product } = await files.upload({
          ...upload,
          productId: fields.productId || null,
          uploader: req.identity ?? demo,
          client: clientOf(req),
          clock: await clockOf(req),
        })
        if (product)
          await audit(req, {
            action: 'attachment.create',
            target: hoseTarget(product),
            changes: filesChange([attachment]),
          })
        return reply.code(201).send(attachment)
      }),
    )

    app.get<{ Params: { id: string } }>('/products/:id/attachments', async (req, reply) =>
      answering(reply, async () =>
        files.ofProduct(req.params.id, clientOf(req), await clockOf(req)),
      ),
    )

    for (const variant of ['file', 'preview'] as const)
      app.get<{ Params: { id: string } }>(`/attachments/:id/${variant}`, async (req, reply) => {
        // A signed link was checked on the way in; a token reads only its company's files.
        const file = await files.read(
          req.params.id,
          variant,
          req.identity ? clientOf(req) : undefined,
        )
        if (!file) return reply.code(404).send({ message: 'Файл не найден' })
        return reply
          .header('Content-Type', file.mimeType)
          .header(
            'Content-Disposition',
            `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
          )
          .header('Cache-Control', 'private, max-age=3600')
          .header('X-Content-Type-Options', 'nosniff')
          .send(file.data)
      })

    app.delete<{ Params: { id: string } }>('/attachments/:id', async (req, reply) =>
      answering(reply, async () => {
        const { fileName, product } = await files.remove(
          req.params.id,
          clientOf(req),
          await clockOf(req),
        )
        await audit(req, {
          action: 'attachment.delete',
          target: hoseTarget(product),
          changes: [{ field: 'Файлы', before: fileName, after: null }],
        })
        return reply.code(204).send()
      }),
    )

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
