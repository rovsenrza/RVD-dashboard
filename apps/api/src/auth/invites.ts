import { createHash, randomBytes } from 'node:crypto'
import type { Db } from '../db/pool.ts'
import { AuthRejected, setOwnPassword } from './service.ts'

/*
 * Invitations by mail (Д6, once there is SMTP — question 7): instead of a
 * one-time password the administrator passes on, the person gets a link and
 * sets their own password. One use, 48 hours; a newer link voids the older.
 */

const HOURS = 48
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export type InviteKind = 'welcome' | 'reset'

/** A fresh link for the user; any link sent before stops working. */
export async function createInvite(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.query(
    'update password_invites set used_at = now() where user_id = $1 and used_at is null',
    [userId],
  )
  await db.query(
    `insert into password_invites (token_hash, user_id, expires_at)
     values ($1, $2, now() + interval '${HOURS} hours')`,
    [hash(token), userId],
  )
  return token
}

/** Who a link is for, while it is good: unused, in time, the user still allowed in. */
export async function readInvite(
  db: Db,
  token: string,
): Promise<{ userId: string; name: string; email: string } | null> {
  const { rows } = await db.query<{ userId: string; name: string; email: string }>(
    `select u.id as "userId", u.name, u.email from password_invites i
     join users u on u.id = i.user_id
     where i.token_hash = $1 and i.used_at is null and i.expires_at > now() and u.active`,
    [hash(token)],
  )
  return rows[0] ?? null
}

/** Sets the person's password from a good link, spends the link and signs them in. */
export async function acceptInvite(db: Db, secret: string, token: string, password: string) {
  const invite = await readInvite(db, token)
  if (!invite)
    throw new AuthRejected(
      404,
      'Ссылка недействительна или устарела — попросите администратора прислать новую',
    )
  const result = await setOwnPassword(db, secret, invite.userId, password)
  await db.query('update password_invites set used_at = now() where token_hash = $1', [hash(token)])
  return result
}

/** The letter with the link, in the cabinet's words. */
export function inviteLetter(
  kind: InviteKind,
  to: { name: string; email: string; company: string },
  link: string,
) {
  const lead =
    kind === 'welcome'
      ? `для вас открыт доступ в «РВД Кабинет» компании ${to.company}.`
      : 'администратор вашей компании сбросил пароль для входа в «РВД Кабинет».'
  return {
    to: to.email,
    subject: kind === 'welcome' ? 'Доступ в «РВД Кабинет»' : 'Новый пароль для «РВД Кабинета»',
    text: [
      `${to.name}, ${lead}`,
      '',
      `Задайте свой пароль по ссылке — она действует ${HOURS} часов и только один раз:`,
      link,
      '',
      `Входить потом — с адресом ${to.email} и этим паролем.`,
      'Если вы не ждали этого письма, просто удалите его.',
    ].join('\n'),
  }
}
