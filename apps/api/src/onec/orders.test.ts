// @vitest-environment node
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildFakeOrders } from './fake-orders.ts'
import {
  HttpOrderService,
  OrderRefused,
  OrderUnavailable,
  requestStatusFrom1C,
  toOrderPayload,
  type OutgoingRequest,
} from './orders.ts'

const request: OutgoingRequest = {
  id: 'req-1',
  clientId: 'client-1',
  kind: 'repair',
  comment: 'Срочно',
  author: { name: 'Иванов Иван', email: 'ivanov@example.ru' },
  positions: [
    {
      productId: 'hose-1',
      catalogNumberId: 'cat-1',
      catalogNumber: '07098-010A9',
      equipmentId: 'eq-1',
      quantity: 1,
    },
    {
      productId: null,
      catalogNumberId: null,
      catalogNumber: '2SC ду10 — течь у муфты',
      equipmentId: null,
      quantity: 2,
    },
  ],
}

describe('the order payload', () => {
  it('names hoses and catalogue numbers by their 1С keys, and unknown text as text', () => {
    expect(toOrderPayload(request)).toEqual({
      cabinetId: 'req-1',
      client: 'client-1',
      kind: 'repair',
      comment: 'Срочно',
      author: { name: 'Иванов Иван', email: 'ivanov@example.ru' },
      lines: [
        {
          product: 'hose-1',
          catalogNumber: 'cat-1',
          catalogNumberText: null,
          equipment: 'eq-1',
          quantity: 1,
          comment: null,
        },
        {
          product: null,
          catalogNumber: null,
          catalogNumberText: '2SC ду10 — течь у муфты',
          equipment: null,
          quantity: 2,
          comment: null,
        },
      ],
      files: [],
    })
  })

  it('reads 1С order statuses, and knows none it was not told about', () => {
    expect(requestStatusFrom1C('Черновик')).toBe('new')
    expect(requestStatusFrom1C('КВыполнению')).toBe('new')
    expect(requestStatusFrom1C('ВРаботе')).toBe('in_progress')
    expect(requestStatusFrom1C('Выполнен')).toBe('done')
    expect(requestStatusFrom1C('Отменён')).toBeNull()
  })
})

describe('HttpOrderService against the stand-in 1С', () => {
  const fake = buildFakeOrders()
  let url = ''
  beforeAll(async () => {
    await fake.listen({ port: 0, host: '127.0.0.1' })
    url = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}/hs/rvd/v1/requests`
  })
  afterAll(() => fake.close())

  it('gets the order number, and the same order again for the same request', async () => {
    const service = new HttpOrderService({ url, user: 'svc', password: 'x' })
    const first = await service.create(toOrderPayload(request), 'req-1')
    expect(first).toMatchObject({
      number: expect.stringMatching(/^СВЦБ-\d{6}$/),
      status: 'Черновик',
    })
    expect(await service.create(toOrderPayload(request), 'req-1')).toEqual(first)
  })

  it('passes 1С’s refusal on as is, and treats silence or a crash as «try later»', async () => {
    const service = new HttpOrderService({ url })
    await expect(
      service.create({ ...toOrderPayload(request), client: '' }, 'req-2'),
    ).rejects.toThrow(new OrderRefused('В заявке нет клиента или строк'))

    const down = new HttpOrderService({
      url,
      fetch: () => Promise.reject(new Error('ECONNREFUSED')),
    })
    await expect(down.create(toOrderPayload(request), 'req-3')).rejects.toBeInstanceOf(
      OrderUnavailable,
    )
    const crashing = new HttpOrderService({
      url,
      fetch: async () => new Response('{}', { status: 500 }),
    })
    await expect(crashing.create(toOrderPayload(request), 'req-4')).rejects.toBeInstanceOf(
      OrderUnavailable,
    )
  })
})
