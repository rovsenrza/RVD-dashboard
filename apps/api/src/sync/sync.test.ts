// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, type Product, type SyncStatus } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import { addUser } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import {
  catalogNumber,
  clients,
  components,
  equipment,
  item,
  release,
  statusRecord,
} from '../onec/__fixtures__/builders.ts'
import { ODataClient } from '../onec/client.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { readHealth } from './health.ts'
import { startSync } from './scheduler.ts'
import { runCheck } from './sync.ts'

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const [A, B, C, DOC] = [id(1), id(2), id(3), id(9)]
const REGISTER = 'InformationRegister_СтатусыИзделий_RecordType'

type Row = object

/** 1С as far as the sync asks it: sets by name, `$filter` by keys or from a time, paging. */
function fakeOneC(sets: Record<string, Row[]>) {
  const asked: string[] = []
  let down = false
  const matches = (filter: string) => (row: Row) =>
    filter.split(' or ').some((part) => {
      const field = (name: string) => (row as Record<string, unknown>)[name]
      const key = part.match(/^(\S+) eq guid'([^']+)'$/)
      if (key) return field(key[1]) === key[2]
      const since = part.match(/^(\S+) ge datetime'([^']+)'$/)
      if (since) return String(field(since[1])) >= since[2]
      throw new Error(`the fake 1С cannot filter by ${part}`)
    })
  const fetch = (async (url: string) => {
    if (down) throw new TypeError('fetch failed')
    const u = new URL(url)
    const entity = decodeURIComponent(u.pathname.split('/').pop()!)
    const filter = u.searchParams.get('$filter')
    asked.push(filter ? `${entity} ? ${filter}` : entity)
    let rows = (sets[entity] ?? []).filter(filter ? matches(filter) : () => true)
    const skip = Number(u.searchParams.get('$skip') ?? 0)
    rows = rows.slice(skip, skip + Number(u.searchParams.get('$top') ?? rows.length))
    return new Response(JSON.stringify({ value: rows }))
  }) as typeof globalThis.fetch
  const client = new ODataClient({
    baseUrl: 'http://1c.test/odata',
    user: 'u',
    password: 'p',
    fetch,
    retries: 0,
    sleep: async () => undefined,
  })
  return { client, sets, asked, setDown: (value: boolean) => (down = value) }
}

describe.skipIf(!hasDb)('the sync keeps up with 1С (Д26)', () => {
  let db: Db
  let drop: () => Promise<void>
  const onec = fakeOneC({
    Catalog_Изделия: [
      { ...item({ Ref_Key: A, Description: 'Рукав A' }), DataVersion: 'v1' },
      { ...item({ Ref_Key: B, Description: 'Рукав B' }), DataVersion: 'v1' },
    ],
    [REGISTER]: [
      statusRecord({ Изделие_Key: A, Recorder: DOC, Period: '2026-01-10T09:00:00' }),
      statusRecord({ Изделие_Key: B, Recorder: DOC, Period: '2026-01-11T09:00:00' }),
    ],
    Document_Выпуск: [release({ Ref_Key: DOC })],
    Catalog_Комплектующие: components,
    Catalog_Техника: [equipment()],
    Catalog_Клиенты: clients,
    Catalog_КаталожныеНомера: [
      catalogNumber(),
      catalogNumber({ Ref_Key: 'cat-gone', DeletionMark: true }),
    ],
  })
  const cached = async () =>
    (await db.query<{ id: string; data: Product }>('select id, data from products order by id'))
      .rows

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
  })
  afterAll(async () => {
    await drop()
  })

  it('rebuilds the first time, having nothing to compare with', async () => {
    const result = await runCheck(db, onec.client)
    expect(result).toMatchObject({ mode: 'full', products: 2 })
    expect((await readHealth(db)).register_mark).toBe('2026-01-11T09:00:00')
    // The supplier's catalogue comes along, without what 1С marked for deletion.
    const { rows } = await db.query('select id, name from catalog_numbers')
    expect(rows).toEqual([{ id: 'cat-1', name: '02753-00613' }])
  })

  it('then reads again only the hoses 1С changed, and drops the ones it removed', async () => {
    const items = onec.sets.Catalog_Изделия
    items[0] = { ...items[0], Description: 'Рукав A, переименован', DataVersion: 'v2' }
    items[1] = { ...items[1], DeletionMark: true, DataVersion: 'v2' }
    items.push({ ...item({ Ref_Key: C, Description: 'Рукав C' }), DataVersion: 'v1' })
    onec.sets[REGISTER].push(
      statusRecord({ Изделие_Key: C, Recorder: DOC, Period: '2026-02-01T09:00:00' }),
    )
    onec.asked.length = 0

    const result = await runCheck(db, onec.client)
    expect(result).toMatchObject({ mode: 'check', refreshed: 2, removed: 1 })
    expect((await cached()).map((r) => [r.id, r.data.type])).toEqual([
      [A, 'Рукав A, переименован'],
      [C, 'Рукав C'],
    ])
    // Nothing read whole but the versions and the small reference sets.
    expect(onec.asked).toContain('Catalog_Изделия')
    expect(onec.asked).toContain(`${REGISTER} ? Period ge datetime'2026-01-11T08:00:00'`)
    expect(onec.asked.filter((q) => q === REGISTER || q === 'Document_Выпуск')).toEqual([])
    expect((await readHealth(db)).register_mark).toBe('2026-02-01T09:00:00')
  })

  it('keeps the cache and says since when 1С is down, until it answers again', async () => {
    const before = await cached()
    onec.setDown(true)
    let failed!: () => void
    const failure = new Promise<void>((resolve) => (failed = resolve))
    const worker = startSync(db, onec.client, {
      intervalMs: 60_000,
      fullHour: 3,
      onError: () => failed(),
    })
    await failure
    worker.stop()
    expect(await cached()).toEqual(before)
    const health = await readHealth(db)
    expect(health.failed_since).toBeInstanceOf(Date)
    expect(health.last_error).toMatch(/1С did not answer/)

    const app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: '2026-10-03', rules: DEFAULT_RULES }),
    })
    const status = (await app.inject('/sync')).json() as SyncStatus
    expect(status.unavailableSince).toBe(health.failed_since!.toISOString())
    expect(status.syncedAt).not.toBeNull()

    onec.setDown(false)
    await runCheck(db, onec.client)
    expect((await app.inject('/sync')).json()).toMatchObject({ unavailableSince: null })
    await app.close()
  })

  it('lets only an administrator ask for a sync now', async () => {
    const secret = 'a-test-secret-that-is-long-enough-1234567890'
    const company = { company: 'ООО Ромашка', clientKey: 'client-1' }
    await addUser(db, {
      ...company,
      name: 'Админ',
      email: 'a@r.ru',
      password: 'админ-пароль-1',
      role: 'admin',
    })
    await addUser(db, {
      ...company,
      name: 'Механик',
      email: 'm@r.ru',
      password: 'механик-пароль-1',
      role: 'mechanic',
    })
    let kicks = 0
    const app = buildApp({
      logLevel: 'silent',
      db,
      auth: { secret },
      sync: { kick: () => kicks++, running: () => false },
    })
    const token = async (email: string, password: string) =>
      (
        await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })
      ).json().accessToken as string
    const post = async (bearer: string) =>
      app.inject({ method: 'POST', url: '/sync', headers: { authorization: `Bearer ${bearer}` } })
    expect((await post(await token('m@r.ru', 'механик-пароль-1'))).statusCode).toBe(403)
    const ok = await post(await token('a@r.ru', 'админ-пароль-1'))
    expect(ok.statusCode).toBe(202)
    expect(kicks).toBe(1)
    await app.close()
  })
})
