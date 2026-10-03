import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { SignedIn, UserRole } from '@rvd/contracts'
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
}

interface AccessClaims {
  sub: string
  name: string
  email: string
  role: UserRole
  cid: string
  cname: string
  ck: string
  iat: number
  exp: number
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
      }
    : null
}

export const signedIn = (identity: Identity, accessToken: string): SignedIn => ({
  accessToken,
  user: { id: identity.userId, name: identity.name, email: identity.email, role: identity.role },
  company: { id: identity.companyId, name: identity.companyName },
})

const IDENTITY = `select u.id as "userId", u.name, u.email, u.role, u.active, u.password_hash,
    c.id as "companyId", c.name as "companyName", c.onec_client_key as "clientKey"
  from users u join companies c on c.id = u.company_id`

type IdentityRow = Identity & { active: boolean; password_hash: string }

const identityOf = ({ active: _a, password_hash: _p, ...identity }: IdentityRow): Identity =>
  identity

async function openSession(db: Db, userId: string, now: Date): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.query(
    `insert into sessions (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)`,
    [randomUUID(), userId, hashToken(token), new Date(now.getTime() + REFRESH_DAYS * 86_400_000)],
  )
  return token
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
    refreshToken: await openSession(db, row.userId, now),
  }
}

/** Trades a live refresh token for a new pair; the old one is spent. */
export async function refresh(
  db: Db,
  secret: string,
  token: string,
  now = new Date(),
): Promise<{ identity: Identity; accessToken: string; refreshToken: string } | null> {
  const { rows } = await db.query<IdentityRow & { session_id: string }>(
    `${IDENTITY.replace('from users u', ', s.id as session_id from sessions s join users u on u.id = s.user_id')}
     where s.token_hash = $1 and s.revoked_at is null and s.expires_at > $2`,
    [hashToken(token), now],
  )
  const row = rows[0]
  if (!row || !row.active) return null
  await db.query('update sessions set revoked_at = $2 where id = $1', [row.session_id, now])
  const { session_id: _s, ...rest } = row
  const identity = identityOf(rest)
  return {
    identity,
    accessToken: issueAccess(identity, secret, now),
    refreshToken: await openSession(db, row.userId, now),
  }
}

export async function logout(db: Db, token: string, now = new Date()): Promise<void> {
  await db.query(
    'update sessions set revoked_at = $2 where token_hash = $1 and revoked_at is null',
    [hashToken(token), now],
  )
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
