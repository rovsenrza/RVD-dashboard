import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  passwordProblem,
  WRONG_CURRENT_PASSWORD,
  type SignedIn,
  type UserRole,
} from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { signJwt, verifyJwt } from './jwt.ts'
import { hashPassword, verifyPassword } from './password.ts'

/** Who is asking, and whose data they may see: their company's 1С client. */
export interface Identity {
  userId: string
  name: string
  email: string
  role: UserRole
  companyId: string
  companyName: string
  clientKey: string
  /** Signed in with a password the administrator gave; only replacing it is allowed */
  mustChangePassword: boolean
}

interface AccessClaims {
  sub: string
  name: string
  email: string
  role: UserRole
  cid: string
  cname: string
  ck: string
  /** Must change the password */
  mcp?: true
  iat: number
  exp: number
}

/** A request the person can put right: the message is shown to them as it is. */
export class AuthRejected extends Error {
  status: 400 | 401 | 403 | 404 | 409 | 422
  constructor(status: AuthRejected['status'], message: string) {
    super(message)
    this.status = status
  }
}

const ACCESS_SECONDS = 15 * 60
export const REFRESH_DAYS = 30

const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url')

export function issueAccess(identity: Identity, secret: string, now = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000)
  const claims: AccessClaims = {
    sub: identity.userId,
    name: identity.name,
    email: identity.email,
    role: identity.role,
    cid: identity.companyId,
    cname: identity.companyName,
    ck: identity.clientKey,
    ...(identity.mustChangePassword && { mcp: true as const }),
    iat,
    exp: iat + ACCESS_SECONDS,
  }
  return signJwt(claims, secret)
}

export function readAccess(token: string, secret: string, now = Date.now()): Identity | null {
  const c = verifyJwt<AccessClaims>(token, secret, now)
  return c
    ? {
        userId: c.sub,
        name: c.name,
        email: c.email,
        role: c.role,
        companyId: c.cid,
        companyName: c.cname,
        clientKey: c.ck,
        mustChangePassword: c.mcp === true,
      }
    : null
}

export const signedIn = (identity: Identity, accessToken: string): SignedIn => ({
  accessToken,
  user: { id: identity.userId, name: identity.name, email: identity.email, role: identity.role },
  company: { id: identity.companyId, name: identity.companyName },
  mustChangePassword: identity.mustChangePassword,
})

const IDENTITY = `select u.id as "userId", u.name, u.email, u.role, u.active, u.password_hash,
    u.must_change_password as "mustChangePassword",
    c.id as "companyId", c.name as "companyName", c.onec_client_key as "clientKey"
  from users u join companies c on c.id = u.company_id`

type IdentityRow = Identity & { active: boolean; password_hash: string }

const identityOf = ({ active: _a, password_hash: _p, ...identity }: IdentityRow): Identity =>
  identity

async function openSession(
  db: Pick<Db, 'query'>,
  userId: string,
  now: Date,
): Promise<{ id: string; token: string }> {
  const id = randomUUID()
  const token = randomBytes(32).toString('base64url')
  await db.query(
    `insert into sessions (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)`,
    [id, userId, hashToken(token), new Date(now.getTime() + REFRESH_DAYS * 86_400_000)],
  )
  return { id, token }
}

/** A matching active user gets an access token and a refresh token; anything else gets null. */
export async function login(
  db: Db,
  secret: string,
  email: string,
  password: string,
  now = new Date(),
): Promise<{ identity: Identity; accessToken: string; refreshToken: string } | null> {
  const { rows } = await db.query<IdentityRow>(`${IDENTITY} where lower(u.email) = lower($1)`, [
    email.trim(),
  ])
  const row = rows[0]
  // The same work whether or not the user exists, so timing says nothing about the e-mail.
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH)
  if (!row || !row.active || !ok) return null
  await db.query('update users set last_login_at = $2 where id = $1', [row.userId, now])
  const identity = identityOf(row)
  return {
    identity,
    accessToken: issueAccess(identity, secret, now),
    refreshToken: (await openSession(db, row.userId, now)).token,
  }
}

/** How long a just-replaced refresh token still answers a request that raced its rotation. */
const RACE_SECONDS = 30

/**
 * Trades a live refresh token for a new pair; the old one is spent. The claim
 * locks the session's row until its successor is stored, so of two requests
 * with one token (two tabs restoring at once, a reload during a renewal) the
 * first rotates it and the other waits, then gets an access token and no
 * refresh token: the browser keeps the successor the first one set.
 */
export async function refresh(
  db: Db,
  secret: string,
  token: string,
  now = new Date(),
): Promise<{ identity: Identity; accessToken: string; refreshToken: string | null } | null> {
  const hash = hashToken(token)
  const client = await db.connect()
  let userId: string | undefined
  let refreshToken: string | null = null
  try {
    await client.query('begin')
    const claimed = await client.query<{ id: string; user_id: string }>(
      `update sessions s set revoked_at = $2
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > $2
          and exists (select 1 from users u where u.id = s.user_id and u.active)
        returning s.id, s.user_id`,
      [hash, now],
    )
    if (claimed.rows.length) {
      const { id, user_id } = claimed.rows[0]
      const successor = await openSession(client, user_id, now)
      await client.query('update sessions set replaced_by = $2 where id = $1', [id, successor.id])
      userId = user_id
      refreshToken = successor.token
    } else {
      const raced = await client.query<{ user_id: string }>(
        `select s.user_id from sessions s
           join sessions next on next.id = s.replaced_by
           join users u on u.id = s.user_id
          where s.token_hash = $1 and s.revoked_at > $3 and u.active
            and next.revoked_at is null and next.expires_at > $2`,
        [hash, now, new Date(now.getTime() - RACE_SECONDS * 1000)],
      )
      userId = raced.rows[0]?.user_id
    }
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
  if (!userId) return null
  const { rows } = await db.query<IdentityRow>(`${IDENTITY} where u.id = $1`, [userId])
  if (!rows[0]) return null
  const identity = identityOf(rows[0])
  return { identity, accessToken: issueAccess(identity, secret, now), refreshToken }
}

export async function logout(db: Db, token: string, now = new Date()): Promise<void> {
  await db.query(
    'update sessions set revoked_at = $2 where token_hash = $1 and revoked_at is null',
    [hashToken(token), now],
  )
}

/** Ends every sign-in of a user: a new password, a reset, access switched off. */
export async function revokeSessions(db: Pick<Db, 'query'>, userId: string, now = new Date()) {
  await db.query('update sessions set revoked_at = $2 where user_id = $1 and revoked_at is null', [
    userId,
    now,
  ])
}

/**
 * The signed-in person replaces their password. Every sign-in made with the
 * old one ends, and this one goes on with a fresh pair of tokens.
 */
export async function changePassword(
  db: Db,
  secret: string,
  userId: string,
  change: { current: string; next: string },
  now = new Date(),
): Promise<{ identity: Identity; accessToken: string; refreshToken: string }> {
  const { rows } = await db.query<IdentityRow>(`${IDENTITY} where u.id = $1`, [userId])
  const row = rows[0]
  if (!row || !row.active) throw new AuthRejected(401, 'Требуется вход')
  if (!(await verifyPassword(change.current, row.password_hash)))
    throw new AuthRejected(400, WRONG_CURRENT_PASSWORD)
  const problem = passwordProblem(change.next)
  if (problem) throw new AuthRejected(400, problem)
  if (change.next === change.current)
    throw new AuthRejected(400, 'Новый пароль совпадает с текущим')
  await db.query(
    'update users set password_hash = $2, must_change_password = false where id = $1',
    [userId, await hashPassword(change.next)],
  )
  await revokeSessions(db, userId, now)
  const identity = { ...identityOf(row), mustChangePassword: false }
  return {
    identity,
    accessToken: issueAccess(identity, secret, now),
    refreshToken: (await openSession(db, userId, now)).token,
  }
}

/**
 * Sets the password the person chose through an invitation link and signs them
 * in: every other session ends, as on a change.
 */
export async function setOwnPassword(
  db: Db,
  secret: string,
  userId: string,
  password: string,
  now = new Date(),
): Promise<{ identity: Identity; accessToken: string; refreshToken: string }> {
  const problem = passwordProblem(password)
  if (problem) throw new AuthRejected(400, problem)
  const { rows } = await db.query<IdentityRow>(`${IDENTITY} where u.id = $1`, [userId])
  const row = rows[0]
  if (!row || !row.active)
    throw new AuthRejected(409, 'Доступ отключён — обратитесь к администратору компании')
  await db.query(
    'update users set password_hash = $2, must_change_password = false where id = $1',
    [userId, await hashPassword(password)],
  )
  await revokeSessions(db, userId, now)
  const identity = { ...identityOf(row), mustChangePassword: false }
  return {
    identity,
    accessToken: issueAccess(identity, secret, now),
    refreshToken: (await openSession(db, userId, now)).token,
  }
}

/** Adds a user, and their company when it is new (by its 1С client). */
export async function addUser(
  db: Db,
  input: {
    company: string
    clientKey: string
    name: string
    email: string
    password: string
    role: UserRole
  },
): Promise<string> {
  const company = await db.query<{ id: string }>(
    `insert into companies (id, name, onec_client_key) values ($1, $2, $3)
     on conflict (onec_client_key) do update set name = excluded.name returning id`,
    [randomUUID(), input.company, input.clientKey],
  )
  const id = randomUUID()
  await db.query(
    `insert into users (id, company_id, name, email, password_hash, role) values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      company.rows[0].id,
      input.name,
      input.email.trim(),
      await hashPassword(input.password),
      input.role,
    ],
  )
  return id
}

// A real hash of nothing in particular, for the «no such user» path.
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64')
