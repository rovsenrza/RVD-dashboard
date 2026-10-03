// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_RULES, type RequestPosition, type ServiceRequest } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import type { Db } from '../db/pool.ts'
import { OrderRefused, OrderUnavailable, type OrderService } from '../onec/orders.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { product } from '../test/rows.ts'
import { deliverDue } from './outbox.ts'
import { refreshRequestStatuses } from './statuses.ts'

const hoseLine = (productId: string): RequestPosition => ({
  productId,
  catalogNumberId: 'forged',
  catalogNumber: 'forged',
  equipmentId: 'forged',
  quantity: 5,
})

describe.skipIf(!hasDb)('requests to 1С', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let kicks = 0

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    await storeCache(
      db,
      {
        products: [
          {
            product: product({ id: 'mine', catalogNumberId: 'cat-1', equipmentId: 'eq-1' }),
            clientId: 'k1',
          },
          { product: product({ id: 'theirs' }), clientId: 'k2' },
        ],
      },
      1,
    )
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: '2026-09-30', rules: DEFAULT_RULES }),
      requests: { clientKey: 'k1', onCreated: () => kicks++ },
    })
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  const post = (body: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/requests', payload: body })
  const list = async () => (await app.inject('/requests')).json() as ServiceRequest[]
  const replace = (productId: string) => ({
    branchId: 'b1',
    kind: 'replace',
    comment: 'Срочно',
    positions: [hoseLine(productId)],
  })

  it('queues a replacement of the cabinet’s own hose, rebuilt from the hose, and kicks the sender', async () => {
    const res = await post(replace('mine'))
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      number: null,
      delivery: 'queued',
      deliveryNote: null,
      status: 'new',
      positions: [
        {
          productId: 'mine',
          catalogNumberId: 'cat-1',
          equipmentId: 'eq-1',
          quantity: 1,
        },
      ],
    })
    expect(kicks).toBe(1)
  })

  it('refuses another client’s hose, and a request with neither lines nor Excel', async () => {
    const theirs = await post(replace('theirs'))
    expect(theirs.statusCode).toBe(400)
    expect(theirs.json().message).toMatch(/только ваши изделия/)
    const empty = await post({ branchId: 'b1', kind: 'manufacture', comment: null, positions: [] })
    expect(empty.json().message).toMatch(/таблицу Excel/)
    const excel = await post({
      branchId: 'b1',
      kind: 'manufacture',
      comment: null,
      positions: [],
      attachmentNames: ['позиции.xlsx'],
    })
    expect(excel.statusCode).toBe(201)
  })

  it('sends the queue: the order number comes back, a refusal names its reason, silence waits', async () => {
    const answers: (() => Promise<{ ref: string; number: string; status: string }>)[] = [
      async () => ({ ref: 'ref-1', number: 'СВЦБ-002201', status: 'Черновик' }),
      async () => {
        throw new OrderRefused('Изделие не принадлежит клиенту')
      },
    ]
    const sent: string[] = []
    const orders: OrderService = {
      create: async (payload, key) => {
        sent.push(`${key}:${payload.client}`)
        return (answers.shift() ?? (async () => Promise.reject(new OrderUnavailable('down'))))()
      },
    }
    const round = await deliverDue(db, orders, new Date(Date.now() + 1000))
    expect(round).toEqual({ delivered: 1, refused: 1, postponed: 0 })
    expect(sent.every((s) => s.endsWith(':k1'))).toBe(true)

    const [excel, first] = await list()
    expect(first).toMatchObject({ number: 'СВЦБ-002201', delivery: 'delivered', status: 'new' })
    expect(excel).toMatchObject({
      number: null,
      delivery: 'refused',
      status: 'rejected',
      deliveryNote: 'Изделие не принадлежит клиенту',
    })
  })

  it('tries again later when 1С does not answer, and says so', async () => {
    await post(replace('mine'))
    const orders: OrderService = {
      create: async () => {
        throw new OrderUnavailable('1С не отвечает')
      },
    }
    const now = new Date(Date.now() + 1000)
    expect(await deliverDue(db, orders, now)).toEqual({ delivered: 0, refused: 0, postponed: 1 })
    expect((await list())[0]).toMatchObject({
      delivery: 'queued',
      deliveryNote: 'Нет связи с 1С — отправим автоматически',
    })
    // Not due again until the pause is over.
    expect(await deliverDue(db, orders, now)).toEqual({ delivered: 0, refused: 0, postponed: 0 })
  })

  it('reads the order’s status and shipment back from 1С', async () => {
    const changed = await refreshRequestStatuses(db, async (refs) =>
      refs.map((ref) => ({ Ref_Key: ref, СтатусЗаказа: 'ВРаботе', Отгрузка: 'Отгружен' })),
    )
    expect(changed).toBe(1)
    const delivered = (await list()).find((r) => r.number === 'СВЦБ-002201')
    expect(delivered).toMatchObject({ status: 'in_progress', shipmentStatus: 'shipped' })
  })
})
