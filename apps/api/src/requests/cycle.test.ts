// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import { DEFAULT_RULES, type CabinetNotification, type ServiceRequest } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import { addUser } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { ODataClient } from '../onec/client.ts'
import { buildFakeOrders } from '../onec/fake-orders.ts'
import { HttpOrderService } from '../onec/orders.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { product } from '../test/rows.ts'
import { deliverDue } from './outbox.ts'
import { fetchOrderStates, refreshRequestStatuses } from './statuses.ts'

/**
 * The full cycle of Milestone 4 (Д20) against the 1С stand-in: a request leaves the
 * cabinet, becomes an order with a СВЦБ number, the manager moves it in «1С», the
 * sync reads the status back, and the client is told the request is done.
 */
describe.skipIf(!hasDb)('a request’s full cycle through 1С (stand-in)', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let fake: ReturnType<typeof buildFakeOrders>
  let base: string
  let token: string
  const today = new Date().toLocaleDateString('sv-SE')

  const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } })
  const mine = async () => ((await call('GET', '/requests')).json() as ServiceRequest[])[0]
  const readBack = () =>
    refreshRequestStatuses(db, (refs) =>
      fetchOrderStates(
        new ODataClient({ baseUrl: `${base}/odata`, user: 'u', password: 'p' }),
        refs,
      ),
    )
  const manager = (number: string, body: object) =>
    fake.inject({
      method: 'POST',
      url: `/manager/orders/${encodeURIComponent(number)}`,
      payload: body,
    })

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    await addUser(db, {
      company: 'ООО Ромашка',
      clientKey: 'k1',
      name: 'Инженер',
      email: 'e@r.ru',
      password: 'инженер-пароль-1',
      role: 'engineer',
    })
    await db.query("update users set created_at = '2026-01-01'")
    await storeCache(
      db,
      {
        products: [
          {
            product: product({
              id: 'h1',
              serialNumber: '101',
              shippedAt: '2025-06-01',
              equipmentId: 'e1',
            }),
            clientId: 'k1',
          },
        ],
      },
      1,
    )
    fake = buildFakeOrders()
    await fake.listen({ port: 0, host: '127.0.0.1' })
    base = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today, rules: DEFAULT_RULES }),
      auth: { secret: 'a-test-secret-that-is-long-enough-1234567890' },
    })
    token = (
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'e@r.ru', password: 'инженер-пароль-1' },
      })
    ).json().accessToken
  })
  afterAll(async () => {
    await app.close()
    await fake.close()
    await drop()
  })

  it('goes from the cabinet to an order, through the manager’s hands, and back to the client', async () => {
    // 1. The client asks for a replacement; it waits for 1С.
    const created = await call('POST', '/requests', {
      branchId: 'b1',
      kind: 'replace',
      comment: 'Течь у фитинга',
      positions: [
        {
          productId: 'h1',
          catalogNumberId: null,
          catalogNumber: null,
          equipmentId: null,
          quantity: 1,
        },
      ],
    })
    expect(created.statusCode).toBe(201)
    expect(await mine()).toMatchObject({ delivery: 'queued', number: null, status: 'new' })

    // 2. The outbox sends it; 1С answers with the order's number.
    const orders = new HttpOrderService({
      url: `${base}/hs/rvd/v1/requests`,
      user: 'u',
      password: 'p',
      timeoutMs: 5000,
    })
    expect(await deliverDue(db, orders, new Date(Date.now() + 1000))).toEqual({
      delivered: 1,
      refused: 0,
      postponed: 0,
    })
    const sent = await mine()
    expect(sent).toMatchObject({ delivery: 'delivered', number: 'СВЦБ-002201', status: 'new' })

    // 3. The manager takes it into work; the sync reads the status back.
    await manager('СВЦБ-002201', { status: 'ВРаботе' })
    expect(await readBack()).toBe(1)
    expect(await mine()).toMatchObject({ status: 'in_progress', shipmentStatus: 'not_shipped' })

    // 4. Done and shipped: the client sees it in the list and is told so.
    await manager('СВЦБ-002201', { status: 'Выполнен', shipment: 'Отгружен' })
    expect(await readBack()).toBe(1)
    expect(await mine()).toMatchObject({ status: 'done', shipmentStatus: 'shipped' })
    const notices = (await call('GET', '/notifications')).json() as CabinetNotification[]
    expect(notices.find((n) => n.kind === 'request_status')).toMatchObject({
      title: 'Заявка СВЦБ-002201',
      message: 'Выполнена в 1С',
      requestId: sent.id,
      productId: 'h1',
      read: false,
    })
  })
})
