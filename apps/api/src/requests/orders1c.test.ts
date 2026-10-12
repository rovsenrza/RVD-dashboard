// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { product } from '../test/rows.ts'
import { importOrders, type RawOrder } from './orders1c.ts'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'
const HOSE = '44444444-4444-4444-4444-444444444444'
const MACHINE = '55555555-5555-5555-5555-555555555555'
const ZERO = '00000000-0000-0000-0000-000000000000'

const order = (Ref_Key: string, over: Partial<RawOrder> = {}): RawOrder => ({
  Ref_Key,
  Number: `СВЦБ-${Ref_Key.slice(0, 3)}  `,
  Date: '2025-08-12T23:30:00',
  Клиент_Key: 'k1',
  СтатусЗаказа: 'ВРаботе',
  Отгрузка: 'НеОтгружен',
  Комментарий: '',
  Изделия: [{ Изделие_Key: HOSE, Техника_Key: MACHINE, КаталожныйНомер_Key: ZERO }],
  ...over,
})

describe.skipIf(!hasDb)('orders made in 1С, in «Заявки»', () => {
  let db: Db
  let drop: () => Promise<void>
  const rows = async () =>
    (
      await db.query(
        `select id, kind, number, status, shipment_status, closed_at, positions,
           to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day
         from requests order by id`,
      )
    ).rows

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    await storeCache(
      db,
      {
        products: [
          {
            product: product({ id: HOSE, catalogNumberId: 'cat-1', catalogNumber: '02753-00613' }),
            clientId: 'k1',
          },
        ],
      },
      1,
    )
    // A request the cabinet sent: 1С made order A for it.
    await db.query(
      `insert into requests (id, client_id, branch_id, kind, positions, author, delivery, onec_ref)
       values ('mine', 'k1', 'k1', 'replace', '[]', '{}', 'delivered', $1)`,
      [A],
    )
  })
  afterAll(async () => drop())

  it('takes in every order but the cabinet’s own, dated as 1С dates it', async () => {
    expect(
      await importOrders(db, [order(A), order(B), order(C, { СтатусЗаказа: 'Выполнен' })]),
    ).toBe(2)
    const [b, c, mine] = await rows()
    expect(mine).toMatchObject({ id: 'mine', kind: 'replace' })
    expect(b).toMatchObject({
      id: `1c-${B}`,
      kind: 'order',
      number: 'СВЦБ-222',
      status: 'in_progress',
      shipment_status: 'not_shipped',
      closed_at: null,
      day: '2025-08-12',
      positions: [
        {
          productId: null,
          catalogNumberId: 'cat-1',
          catalogNumber: '02753-00613',
          equipmentId: MACHINE,
          quantity: 1,
        },
      ],
    })
    // Already closed when first seen: history, not news — no «заявка выполнена» notice.
    expect(c).toMatchObject({ status: 'done', closed_at: null })
  })

  it('follows an order as 1С moves it, and writes nothing when nothing moved', async () => {
    expect(await importOrders(db, [order(B), order(C, { СтатусЗаказа: 'Выполнен' })])).toBe(0)
    expect(
      await importOrders(db, [order(B, { СтатусЗаказа: 'Выполнен', Отгрузка: 'Отгружен' })]),
    ).toBe(1)
    const [b] = await rows()
    expect(b).toMatchObject({ status: 'done', shipment_status: 'shipped' })
    expect(b.closed_at).not.toBeNull()
  })
})
