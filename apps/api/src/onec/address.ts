import type { OnecAddress } from '@rvd/contracts'
import { AuthRejected } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { ODataClient, type ODataClientOptions } from './client.ts'

/**
 * The 1С address the supplier's staff set in their section; without one, ODATA_URL from the
 * server's settings. The base moves servers with its keys (customer, 2026-10-24), so only the
 * address changes: the login and password stay where they are.
 */
export async function onecAddress(db: Db, fallback: string): Promise<OnecAddress> {
  const { rows } = await db.query<{ url: string; changed_by: string; changed_at: Date }>(
    'select url, changed_by, changed_at from onec_address',
  )
  const row = rows[0]
  return row
    ? { url: row.url, changedBy: row.changed_by, changedAt: row.changed_at.toISOString() }
    : { url: fallback, changedBy: null, changedAt: null }
}

const problemOf = (url: unknown): string | null => {
  if (typeof url !== 'string' || !url.trim()) return 'Укажите адрес публикации 1С'
  try {
    const { protocol } = new URL(url.trim())
    return protocol === 'https:' || protocol === 'http:' ? null : 'Адрес начинается с https://'
  } catch {
    return 'Это не адрес: например, https://server/base/odata/standard.odata'
  }
}

/**
 * Checks the new address answers as this 1С base before keeping it, so a typo never cuts the
 * cabinet off its data: one client read with the login and password the cabinet already has.
 */
export async function saveOnecAddress(
  db: Db,
  url: unknown,
  by: string,
  credentials: Pick<ODataClientOptions, 'user' | 'password' | 'fetch'>,
): Promise<OnecAddress> {
  const problem = problemOf(url)
  if (problem) throw new AuthRejected(400, problem)
  const next = (url as string).trim().replace(/\/+$/, '')
  const probe = new ODataClient({ ...credentials, baseUrl: next, timeoutMs: 15_000, retries: 0 })
  try {
    await probe.page('Catalog_Клиенты', { select: ['Ref_Key'], top: 1 })
  } catch {
    throw new AuthRejected(
      422,
      '1С по этому адресу не ответила — адрес не сохранён, кабинет работает по прежнему',
    )
  }
  await db.query(
    `insert into onec_address (url, changed_by) values ($1, $2)
     on conflict (id) do update set url = $1, changed_by = $2, changed_at = now()`,
    [next, by],
  )
  return onecAddress(db, next)
}
