import {
  DEFAULT_NOTIFICATION_PREFS,
  hoseNoticeText,
  hoseNoticeTitle,
  NOTIFICATION_WINDOW_DAYS,
  notificationPrefsProblem,
  requestNoticeText,
  type CabinetNotification,
  type NotificationKind,
  type NotificationPrefs,
} from '@rvd/contracts'
import { AuthRejected } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'

export type Prefs = Pick<NotificationPrefs, 'kinds' | 'email'>

/** Whose notices to work out, and by which company rules. */
export interface Reader {
  /** The signed-in person; null without sign-in — then nothing is ever read */
  userId: string | null
  /** The company's 1С client; undefined — every client (no sign-in, no client configured) */
  client?: string
  /** The company's lead days (settings) */
  leadDays: number[]
  kinds: Prefs['kinds']
}

interface HoseRow {
  kind: Exclude<NotificationKind, 'request_status'>
  lead: number
  id: string
  serial_number: string
  garage_number: string | null
  branch_id: string
  due: string
  fired: string
}

interface RequestRow {
  id: string
  number: string | null
  status: 'done' | 'rejected'
  branch_id: string
  product_id: string | null
  closed_at: Date
}

/** The scheduler's hour: a hose notice is dated six in the morning of the day it fired. */
const morning = (day: string) => new Date(`${day}T06:00:00`).toISOString()

/**
 * The notices of the last 30 days, newest first — what a daily scheduler would
 * have written (Д19), worked out from the cache instead: each hose in service
 * fires `lead` days before its warranty ends and its planned replacement (by the
 * company's lead days) and on the day its life runs out, each request when 1С
 * closed it. Nothing older than the person's account. Ids are stable — kind,
 * object, date and lead — so a read stays read.
 */
export async function listNotifications(
  db: Db,
  today: string,
  reader: Reader,
): Promise<CabinetNotification[]> {
  const {
    rows: [{ since }],
  } = await db.query<{ since: string }>(
    `select to_char(greatest($1::date - ${NOTIFICATION_WINDOW_DAYS - 1},
       coalesce((select created_at::date from users where id = $2), '-infinity'::date)),
       'YYYY-MM-DD') as since`,
    [today, reader.userId],
  )
  const params = [today, reader.client ?? null, reader.leadDays, since]
  const { rows: hoses } = await db.query<HoseRow>(
    `with p as (
       select id, serial_number, equipment_id, branch_id, warranty_days, service_life_days,
         coalesce(installed_at, shipped_at) as start
       from products
       where ($2::text is null or client_id = $2) and lifecycle <> 'written_off'
         and coalesce(installed_at, shipped_at) is not null
     ),
     f as (
       select p.*, 'warranty_end' as kind, l as lead, start + warranty_days as due
         from p cross join unnest($3::int[]) as l where warranty_days > 0
       union all
       select p.*, 'planned_replacement', l, start + service_life_days
         from p cross join unnest($3::int[]) as l where service_life_days > 0
       union all
       select p.*, 'overdue', 0, start + service_life_days from p where service_life_days > 0
     )
     select f.kind, f.lead, f.id, f.serial_number, e.garage_number, f.branch_id,
       to_char(f.due, 'YYYY-MM-DD') as due, to_char(f.due - f.lead, 'YYYY-MM-DD') as fired
     from f left join equipment e on e.id = f.equipment_id
     where f.due - f.lead between $4::date and $1::date`,
    params,
  )
  const { rows: closed } = await db.query<RequestRow>(
    `select id, number, status, branch_id, closed_at,
       case when jsonb_array_length(positions) = 1 then positions -> 0 ->> 'productId' end
         as product_id
     from requests
     where ($2::text is null or client_id = $2) and status in ('done', 'rejected')
       and closed_at::date between $3::date and $1::date`,
    [today, reader.client ?? null, since],
  )
  const read = await readIds(db, reader.userId)

  const list: Omit<CabinetNotification, 'read'>[] = [
    ...hoses.map((h) => ({
      id: `${h.kind}.${h.id}.${h.due}.${h.lead}`,
      kind: h.kind,
      lead: h.lead,
      title: hoseNoticeTitle(h.serial_number, h.garage_number),
      message: hoseNoticeText(h.kind, h.due, h.lead),
      dueDate: h.due,
      productId: h.id,
      requestId: null,
      branchId: h.branch_id,
      createdAt: morning(h.fired),
    })),
    ...closed.map((r) => ({
      id: `request_status.${r.id}`,
      kind: 'request_status' as const,
      lead: null,
      title: r.number ? `Заявка ${r.number}` : 'Заявка',
      message: requestNoticeText(r.status),
      dueDate: null,
      productId: r.product_id,
      requestId: r.id,
      branchId: r.branch_id,
      createdAt: r.closed_at.toISOString(),
    })),
  ]
  return list
    .filter((n) => reader.kinds[n.kind])
    .map((n) => ({ ...n, read: read.has(n.id) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
}

async function readIds(db: Db, userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set()
  const { rows } = await db.query<{ notification_id: string }>(
    'select notification_id from notification_reads where user_id = $1',
    [userId],
  )
  return new Set(rows.map((r) => r.notification_id))
}

/** Marks notices read for the person; reads older than any notice still shown are dropped. */
export async function markRead(db: Db, userId: string, ids: string[]): Promise<void> {
  await db.query(
    `insert into notification_reads (user_id, notification_id)
     select $1, unnest($2::text[]) on conflict do nothing`,
    [userId, ids],
  )
  await db.query(
    `delete from notification_reads where user_id = $1 and read_at < now() - interval '60 days'`,
    [userId],
  )
}

/** What the person chose, over hearing about everything. */
export async function notificationPrefs(db: Db, userId: string | null): Promise<Prefs> {
  const { rows } = userId
    ? await db.query<Prefs>('select kinds, email from notification_prefs where user_id = $1', [
        userId,
      ])
    : { rows: [] }
  return {
    kinds: { ...DEFAULT_NOTIFICATION_PREFS.kinds, ...rows[0]?.kinds },
    email: rows[0]?.email ?? DEFAULT_NOTIFICATION_PREFS.email,
  }
}

/** Checks and stores a change of the person's choice; answers the whole choice. */
export async function saveNotificationPrefs(
  db: Db,
  userId: string,
  patch: Partial<Prefs>,
): Promise<Prefs> {
  const problem = notificationPrefsProblem(patch)
  if (problem) throw new AuthRejected(400, problem)
  await db.query(
    `insert into notification_prefs (user_id, kinds, email)
     values ($1, $2::jsonb, coalesce($3, true))
     on conflict (user_id) do update set
       kinds = notification_prefs.kinds || excluded.kinds,
       email = coalesce($3, notification_prefs.email)`,
    [userId, JSON.stringify(patch.kinds ?? {}), patch.email ?? null],
  )
  return notificationPrefs(db, userId)
}
