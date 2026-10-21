import { randomBytes, randomUUID } from 'node:crypto'
import {
  isSupplierEmail,
  type OnecClient,
  type SupplierCompany,
  type SupplierMailbox,
} from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { hashPassword } from '../auth/password.ts'
import { AuthRejected, revokeSessions } from '../auth/service.ts'
import { createUser } from '../auth/users.ts'

/*
 * The supplier's own section (customer, 2026-10-22): its staff register client
 * companies from the clients 1С holds, switch them off, and say where each
 * supplier branch's letters go. The 1С sets come from the sync's last copies
 * (`onec_snapshots`), so the section works while 1С is away.
 */

/** A 1С client as the sync keeps it (`Catalog_Клиенты`). */
interface RawClient {
  Ref_Key: string
  Description: string
  ИНН?: string
  Филиал_Key?: string
  DeletionMark?: boolean
}

const ZERO = '00000000-0000-0000-0000-000000000000'
const ref = (key: string | undefined) => (key && key !== ZERO ? key : null)

async function snapshot<T>(db: Db, entity: string): Promise<T[]> {
  const { rows } = await db.query<{ rows: T[] }>(
    'select rows from onec_snapshots where entity = $1',
    [entity],
  )
  return rows[0]?.rows ?? []
}

/**
 * One of the supplier's staff, in the supplier's own company (made with the first). Without
 * a `password` nobody knows theirs: they set it through «Забыли пароль?».
 */
export async function addStaff(
  db: Db,
  input: { name: string; email: string; password?: string },
): Promise<string> {
  if (!isSupplierEmail(input.email)) throw new AuthRejected(400, 'Почта — @vgiz.ru или @snabsv.ru')
  await db.query(
    `insert into companies (id, name, onec_client_key, kind)
     values ('supplier', 'ВГИЗ', 'supplier', 'supplier') on conflict (id) do nothing`,
  )
  const id = randomUUID()
  await db.query(
    `insert into users (id, company_id, name, email, password_hash, role)
     values ($1, 'supplier', $2, $3, $4, 'admin')`,
    [
      id,
      input.name.trim(),
      input.email.trim(),
      await hashPassword(input.password ?? randomBytes(32).toString('hex')),
    ],
  )
  return id
}

/** Every client company with its branches and people; the supplier's own staff are not one. */
export async function listCompanies(db: Db): Promise<SupplierCompany[]> {
  const { rows } = await db.query<SupplierCompany>(
    `select c.id, c.name, c.active,
       coalesce((select json_agg(json_build_object('id', b.client_key, 'name', b.name) order by b.name)
                   from company_branches b where b.company_id = c.id), '[]') as branches,
       coalesce((select json_agg(json_build_object('id', u.id, 'name', u.name, 'email', u.email,
                   'role', u.role, 'active', u.active) order by u.name)
                   from users u where u.company_id = c.id), '[]') as users
     from companies c where c.kind = 'client' order by c.name`,
  )
  return rows
}

/** The clients 1С holds, and the company each is a branch of already. */
export async function listOnecClients(db: Db): Promise<OnecClient[]> {
  const clients = await snapshot<RawClient>(db, 'Catalog_Клиенты')
  const { rows } = await db.query<{ client_key: string; company_id: string }>(
    'select client_key, company_id from company_branches',
  )
  const taken = new Map(rows.map((r) => [r.client_key, r.company_id]))
  return clients
    .filter((c) => !c.DeletionMark)
    .map((c) => ({
      id: c.Ref_Key,
      name: c.Description.trim(),
      inn: c.ИНН?.trim() || null,
      filialId: ref(c.Филиал_Key),
      companyId: taken.get(c.Ref_Key) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

async function clientNames(db: Db, keys: string[]): Promise<Map<string, string>> {
  const known = new Map((await listOnecClients(db)).map((c) => [c.id, c]))
  const names = new Map<string, string>()
  for (const key of keys) {
    const client = known.get(key)
    if (!client) throw new AuthRejected(400, 'Клиент не найден в 1С')
    if (client.companyId) throw new AuthRejected(409, `${client.name} — уже филиал другой компании`)
    names.set(key, client.name)
  }
  return names
}

export interface NewCompany {
  name: string
  clientKeys: string[]
  admin: { name: string; email: string }
}

/**
 * A client company from one or more 1С clients — each a branch — and its first
 * administrator, who gets in by an invitation (or a one-time password without mail).
 */
export async function createCompany(db: Db, input: NewCompany) {
  const name = input.name.trim()
  const keys = [...new Set(input.clientKeys)]
  if (!name) throw new AuthRejected(400, 'Укажите название компании')
  if (!keys.length) throw new AuthRejected(400, 'Выберите клиента 1С')
  const names = await clientNames(db, keys)
  const id = randomUUID()
  await db.query(`insert into companies (id, name, onec_client_key) values ($1, $2, $3)`, [
    id,
    name,
    keys[0],
  ])
  await db.query(
    `insert into company_branches (client_key, company_id, name)
     select k, $1, n from unnest($2::text[], $3::text[]) as t(k, n)`,
    [id, keys, keys.map((k) => names.get(k)!)],
  )
  try {
    const { user, password } = await createUser(db, id, {
      name: input.admin.name,
      email: input.admin.email,
      role: 'admin',
      branchIds: [],
    })
    return { companyId: id, user, password }
  } catch (error) {
    // No company without its administrator: a taken e-mail leaves nothing behind.
    await db.query('delete from companies where id = $1', [id])
    throw error
  }
}

/** One more 1С client as a branch of the company. */
export async function addCompanyBranch(db: Db, companyId: string, clientKey: string) {
  const names = await clientNames(db, [clientKey])
  const { rowCount } = await db.query(
    `insert into company_branches (client_key, company_id, name)
     select $1, id, $3 from companies where id = $2 and kind = 'client'`,
    [clientKey, companyId, names.get(clientKey)],
  )
  if (!rowCount) throw new AuthRejected(404, 'Компания не найдена')
}

/** Access for the whole company on or off; off ends every sign-in of its people at once. */
export async function setCompanyActive(db: Db, companyId: string, active: boolean) {
  const { rows } = await db.query<{ name: string }>(
    `update companies set active = $2 where id = $1 and kind = 'client' returning name`,
    [companyId, active],
  )
  if (!rows[0]) throw new AuthRejected(404, 'Компания не найдена')
  if (!active) {
    const { rows: people } = await db.query<{ id: string }>(
      'select id from users where company_id = $1',
      [companyId],
    )
    for (const p of people) await revokeSessions(db, p.id)
    // A staff member looking at it is sent back at their next renewal.
    await db.query(
      'update sessions set revoked_at = now() where acting_company = $1 and revoked_at is null',
      [companyId],
    )
  }
  return rows[0].name
}

const GENERAL = 'Общий ящик'

/** The general mailbox, then each supplier branch 1С holds, with where their letters go. */
export async function listMailboxes(db: Db): Promise<SupplierMailbox[]> {
  const filials = (await snapshot<RawClient>(db, 'Catalog_Филиалы')).filter((f) => !f.DeletionMark)
  const { rows } = await db.query<{
    filial_key: string
    requests_email: string | null
    support_email: string | null
  }>('select filial_key, requests_email, support_email from supplier_mailboxes')
  const saved = new Map(rows.map((r) => [r.filial_key, r]))
  return [{ Ref_Key: '', Description: GENERAL }, ...filials].map((f) => ({
    filialId: f.Ref_Key,
    name: f.Description.trim(),
    requestsEmail: saved.get(f.Ref_Key)?.requests_email ?? null,
    supportEmail: saved.get(f.Ref_Key)?.support_email ?? null,
  }))
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Saves the addresses given; an empty one means «the general mailbox». */
export async function saveMailboxes(db: Db, boxes: Partial<SupplierMailbox>[]) {
  const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  for (const b of boxes) {
    for (const email of [clean(b.requestsEmail), clean(b.supportEmail)])
      if (email && !EMAIL.test(email)) throw new AuthRejected(400, `Неверный адрес: ${email}`)
  }
  for (const b of boxes) {
    if (typeof b.filialId !== 'string') continue
    await db.query(
      `insert into supplier_mailboxes (filial_key, requests_email, support_email) values ($1, $2, $3)
       on conflict (filial_key) do update
         set requests_email = excluded.requests_email, support_email = excluded.support_email`,
      [b.filialId, clean(b.requestsEmail), clean(b.supportEmail)],
    )
  }
  return listMailboxes(db)
}

/**
 * Where a client's letter goes: the mailbox of the supplier branch that serves it
 * (its `Филиал_Key` in 1С), else the general one, else `fallback` (the server's setting).
 */
export async function mailboxFor(
  db: Db,
  clientKey: string | null,
  kind: 'requests' | 'support',
  fallback: string | undefined,
): Promise<string | undefined> {
  const column = kind === 'requests' ? 'requests_email' : 'support_email'
  const { rows } = await db.query<{ to: string | null }>(
    `select coalesce(
       (select m.${column} from supplier_mailboxes m
          where m.filial_key <> '' and m.filial_key = (
            select c->>'Филиал_Key' from onec_snapshots s, jsonb_array_elements(s.rows) c
             where s.entity = 'Catalog_Клиенты' and c->>'Ref_Key' = $1 limit 1)),
       (select ${column} from supplier_mailboxes where filial_key = '')) as "to"`,
    [clientKey ?? ''],
  )
  return rows[0]?.to ?? fallback
}
