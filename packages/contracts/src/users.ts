import type { CabinetUser, UserRole } from './types'

export const USER_ROLES: readonly UserRole[] = ['mechanic', 'engineer', 'manager', 'admin']

export const MIN_PASSWORD_LENGTH = 10

/** Refusals a form shows under the field they are about, so the API and the form share the words. */
export const EMAIL_TAKEN = 'Пользователь с такой почтой уже есть'
export const WRONG_CURRENT_PASSWORD = 'Текущий пароль не подходит'

/** Why a new password will not do, or null: the one rule for the form, the API and the CLI. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Пароль — не короче ${MIN_PASSWORD_LENGTH} символов`
  if (!password.trim()) return 'Пароль не может состоять из пробелов'
  return null
}

/**
 * How a new or reset password reaches the person: a link by e-mail, or — while
 * the cabinet has no mail server — a one-time password the administrator
 * passes on; the person replaces it at the first sign-in.
 */
export type PasswordDelivery =
  { kind: 'email'; sentTo: string } | { kind: 'password'; password: string }

/** `POST /admin/users`: the user just added and how they get in. */
export interface UserCreated {
  user: CabinetUser
  delivery: PasswordDelivery
}

/** `POST /auth/password`: the signed-in person replaces their own password. */
export interface PasswordChange {
  current: string
  next: string
}
