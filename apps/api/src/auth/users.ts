import { randomInt, randomUUID } from 'node:crypto'
import { EMAIL_TAKEN, USER_ROLES, type CabinetUser, type UserRole } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { hashPassword } from './password.ts'
import { AuthRejected, revokeSessions } from './service.ts'

/** What the administrator sets; id, access history and the password are the server's. */
export interface UserDraft {
  name: string
  email: string
  role: UserRole
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
}

const USER = 'select id, name, email, role, active, last_login_at from users'

// 1С keeps no branches of the client yet, so everyone works across the whole company.
const toUser = (r: UserRow): CabinetUser => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  branchIds: [],
  active: r.active,
  lastLoginAt: r.last_login_at?.toISOString() ?? null,
})

/** The company's users, by name. */
export async function listUsers(db: Db, companyId: string): Promise<CabinetUser[]> {
  const { rows } = await db.query<UserRow>(`${USER} where company_id = $1 order by name, id`, [
    companyId,
  ])
  return rows.map(toUser)
}

async function findUser(db: Db, companyId: string, id: string): Promise<UserRow> {
  const { rows } = await db.query<UserRow>(`${USER} where id = $1 and company_id = $2`, [
    id,
    companyId,
  ])
  if (!rows[0]) throw new AuthRejected(404, 'Пользователь не найден')
  return rows[0]
}

/** Adds a user to the company with a one-time password, which is returned once and stored only as a hash. */
export async function createUser(
  db: Db,
  companyId: string,
  draft: UserDraft,
): Promise<{ user: CabinetUser; password: string }> {
  const problem =
    draftProblem(draft) ?? (draft.name && draft.email && draft.role ? null : 'Заполните все поля')
  if (problem) throw new AuthRejected(400, problem)
  const password = temporaryPassword()
  try {
    const { rows } = await db.query<UserRow>(
      `insert into users (id, company_id, name, email, password_hash, role, must_change_password)
       values ($1, $2, $3, $4, $5, $6, true)
       returning id, name, email, role, active, last_login_at`,
      [
        randomUUID(),
        companyId,
        draft.name.trim(),
        draft.email.trim(),
        await hashPassword(password),
        draft.role,
      ],
    )
    return { user: toUser(rows[0]), password }
  } catch (error) {
    if (isTaken(error)) throw new AuthRejected(409, EMAIL_TAKEN)
    throw error
  }
}

/**
 * Changes a user's name, e-mail, role or access. Nobody changes their own
 * role or access — another administrator does, so the company always keeps
 * one. Switching access off ends the user's sign-ins at once.
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
  try {
    const { rows } = await db.query<UserRow>(
      `update users set
         name = coalesce($3, name),
         email = coalesce($4, email),
         role = coalesce($5, role),
         active = coalesce($6, active)
       where id = $1 and company_id = $2
       returning id, name, email, role, active, last_login_at`,
      [
        id,
        companyId,
        patch.name?.trim() ?? null,
        patch.email?.trim() ?? null,
        patch.role ?? null,
        patch.active ?? null,
      ],
    )
    if (patch.active === false) await revokeSessions(db, id)
    return toUser(rows[0])
  } catch (error) {
    if (isTaken(error)) throw new AuthRejected(409, EMAIL_TAKEN)
    throw error
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
