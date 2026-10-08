import { randomInt, randomUUID } from 'node:crypto'
import {
  EMAIL_TAKEN,
  isBranchBound,
  USER_ROLES,
  type CabinetUser,
  type UserRole,
} from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { hashPassword } from './password.ts'
import { AuthRejected, revokeSessions } from './service.ts'

/** What the administrator sets; id, access history and the password are the server's. */
export interface UserDraft {
  name: string
  email: string
  role: UserRole
  /** Branches — the company's 1С clients — the person works in; none: the whole company */
  branchIds?: string[]
}

// No 0/O, 1/l/I: the password is read off a screen and typed by someone else.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** A one-time password the administrator passes on: three groups of four, about 69 bits. */
export const temporaryPassword = () =>
  Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''),
  ).join('-')

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function draftProblem(draft: Partial<UserDraft>): string | null {
  if (draft.name !== undefined && !draft.name.trim()) return 'Укажите ФИО'
  if (draft.email !== undefined && !EMAIL.test(draft.email.trim())) return 'Проверьте почту'
  if (draft.role !== undefined && !USER_ROLES.includes(draft.role)) return 'Неизвестная роль'
  return null
}

const isTaken = (error: unknown) => (error as { code?: string }).code === '23505'

interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  last_login_at: Date | null
  branch_ids: string[]
}

const USER = `select u.id, u.name, u.email, u.role, u.active, u.last_login_at,
    coalesce((select array_agg(client_key order by client_key) from user_branches
               where user_id = u.id), '{}') as branch_ids
  from users u`

const toUser = (r: UserRow): CabinetUser => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  branchIds: r.branch_ids,
  active: r.active,
  lastLoginAt: r.last_login_at?.toISOString() ?? null,
})

/** The company's users, by name. */
export async function listUsers(db: Db, companyId: string): Promise<CabinetUser[]> {
  const { rows } = await db.query<UserRow>(
    `${USER} where u.company_id = $1 order by u.name, u.id`,
    [companyId],
  )
  return rows.map(toUser)
}

async function findUser(db: Db, companyId: string, id: string): Promise<UserRow> {
  const { rows } = await db.query<UserRow>(`${USER} where u.id = $1 and u.company_id = $2`, [
    id,
    companyId,
  ])
  if (!rows[0]) throw new AuthRejected(404, 'Пользователь не найден')
  return rows[0]
}

/** The company's branches by key, with their names: what a user may be bound to. */
export async function companyBranchNames(db: Db, companyId: string): Promise<Map<string, string>> {
  const { rows } = await db.query<{ client_key: string; name: string }>(
    'select client_key, name from company_branches where company_id = $1',
    [companyId],
  )
  return new Map(rows.map((r) => [r.client_key, r.name]))
}

/**
 * The branches a user is to work in, checked: the company's own, and exactly one
 * for a mechanic — the only one there is when the company has a single branch.
 */
async function branchesFor(
  db: Db,
  companyId: string,
  role: UserRole,
  asked: string[],
): Promise<string[]> {
  const known = await companyBranchNames(db, companyId)
  const ids = [...new Set(asked)]
  if (ids.some((id) => !known.has(id))) throw new AuthRejected(400, 'Филиал не из этой компании')
  if (isBranchBound(role) && ids.length !== 1) {
    if (!ids.length && known.size === 1) return [...known.keys()]
    throw new AuthRejected(400, 'Механику нужен ровно один филиал')
  }
  return ids
}

async function saveBranches(db: Pick<Db, 'query'>, userId: string, ids: string[]) {
  await db.query('delete from user_branches where user_id = $1', [userId])
  if (ids.length)
    await db.query(
      'insert into user_branches (user_id, client_key) select $1, unnest($2::text[])',
      [userId, ids],
    )
}

/** One of the company's users, as they are before a change (for the action log). */
export const getUser = async (db: Db, companyId: string, id: string): Promise<CabinetUser> =>
  toUser(await findUser(db, companyId, id))

/** Adds a user to the company with a one-time password, which is returned once and stored only as a hash. */
export async function createUser(
  db: Db,
  companyId: string,
  draft: UserDraft,
): Promise<{ user: CabinetUser; password: string }> {
  const problem =
    draftProblem(draft) ?? (draft.name && draft.email && draft.role ? null : 'Заполните все поля')
  if (problem) throw new AuthRejected(400, problem)
  const branchIds = await branchesFor(db, companyId, draft.role, draft.branchIds ?? [])
  const password = temporaryPassword()
  const id = randomUUID()
  await inTransaction(db, async (tx) => {
    await tx.query(
      `insert into users (id, company_id, name, email, password_hash, role, must_change_password)
       values ($1, $2, $3, $4, $5, $6, true)`,
      [
        id,
        companyId,
        draft.name.trim(),
        draft.email.trim(),
        await hashPassword(password),
        draft.role,
      ],
    )
    await saveBranches(tx, id, branchIds)
  })
  return { user: await getUser(db, companyId, id), password }
}

/**
 * Changes a user's name, e-mail, role, branches or access. Nobody changes their
 * own role or access — another administrator does, so the company always keeps
 * one. Switching access off ends the user's sign-ins at once; new branches
 * reach the person with their next token (a quarter of an hour at most).
 */
export async function updateUser(
  db: Db,
  companyId: string,
  actorId: string,
  id: string,
  patch: Partial<UserDraft> & { active?: boolean },
): Promise<CabinetUser> {
  const user = await findUser(db, companyId, id)
  const ownRole = patch.role !== undefined && patch.role !== user.role
  const ownAccess = patch.active !== undefined && patch.active !== user.active
  if (id === actorId && (ownRole || ownAccess))
    throw new AuthRejected(409, 'Свою роль и доступ меняет другой администратор')
  const problem = draftProblem(patch)
  if (problem) throw new AuthRejected(400, problem)
  // A new role is checked against the branches the user keeps, unless new ones come with it.
  const branchIds =
    patch.branchIds !== undefined || ownRole
      ? await branchesFor(
          db,
          companyId,
          patch.role ?? user.role,
          patch.branchIds ?? user.branch_ids,
        )
      : null
  await inTransaction(db, async (tx) => {
    await tx.query(
      `update users set
         name = coalesce($3, name),
         email = coalesce($4, email),
         role = coalesce($5, role),
         active = coalesce($6, active)
       where id = $1 and company_id = $2`,
      [
        id,
        companyId,
        patch.name?.trim() ?? null,
        patch.email?.trim() ?? null,
        patch.role ?? null,
        patch.active ?? null,
      ],
    )
    if (branchIds) await saveBranches(tx, id, branchIds)
  })
  if (patch.active === false) await revokeSessions(db, id)
  return getUser(db, companyId, id)
}

/** The user and their branches go in together; a taken e-mail is the administrator's to fix. */
async function inTransaction(db: Db, work: (tx: Pick<Db, 'query'>) => Promise<void>) {
  const tx = await db.connect()
  try {
    await tx.query('begin')
    await work(tx)
    await tx.query('commit')
  } catch (error) {
    await tx.query('rollback')
    if (isTaken(error)) throw new AuthRejected(409, EMAIL_TAKEN)
    throw error
  } finally {
    tx.release()
  }
}

/** A new one-time password for a user who lost theirs; their sign-ins end. */
export async function resetPassword(db: Db, companyId: string, id: string): Promise<string> {
  const user = await findUser(db, companyId, id)
  if (!user.active) throw new AuthRejected(409, 'Сначала верните пользователю доступ')
  const password = temporaryPassword()
  await db.query('update users set password_hash = $2, must_change_password = true where id = $1', [
    id,
    await hashPassword(password),
  ])
  await revokeSessions(db, id)
  return password
}
