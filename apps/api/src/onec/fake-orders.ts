import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import Fastify from 'fastify'

interface FakeOrder {
  ref: string
  number: string
  status: string
  shipment: string
}

/**
 * A stand-in for 1С until the real order service exists (Д20): the service of
 * docs/1c/request-api.md (201 with a «СВЦБ-…» number, the same order again for a
 * repeated Idempotency-Key, 422 with a reason), the order states the sync reads
 * back by OData, and a manager's hand to move an order along. Run it with
 * `npm run fake-1c -w @rvd/api`, then point the API at it:
 *   ONEC_ORDERS_URL=http://localhost:3101/hs/rvd/v1/requests
 *   ONEC_ORDER_STATES_URL=http://localhost:3101/odata
 * and move an order: curl -X POST localhost:3101/manager/orders/СВЦБ-002201 \
 *   -H 'content-type: application/json' -d '{"status":"Выполнен","shipment":"Отгружен"}'
 */
export function buildFakeOrders() {
  const app = Fastify({ logger: false })
  const byKey = new Map<string, FakeOrder>()
  let seq = 2200

  app.post('/hs/rvd/v1/requests', async (req, reply) => {
    const key = req.headers['idempotency-key']
    if (typeof key !== 'string' || !key)
      return reply.code(422).send({ error: 'Нет Idempotency-Key' })
    const known = byKey.get(key)
    if (known)
      return reply.code(200).send({ ref: known.ref, number: known.number, status: known.status })
    const body = req.body as { client?: string; lines?: unknown[] } | undefined
    if (!body?.client || !Array.isArray(body.lines))
      return reply.code(422).send({ error: 'В заявке нет клиента или строк' })
    const order: FakeOrder = {
      ref: randomUUID(),
      number: `СВЦБ-${String(++seq).padStart(6, '0')}`,
      status: 'Черновик',
      shipment: 'НеОтгружен',
    }
    byKey.set(key, order)
    return reply.code(201).send({ ref: order.ref, number: order.number, status: order.status })
  })

  // What the sync reads back (`Document_ЗаказыКлиента`, by Ref_Key), as 1С's OData answers it.
  app.get('/odata/Document_ЗаказыКлиента', async (req) => {
    const filter = String((req.query as { $filter?: string }).$filter ?? '')
    const refs = new Set([...filter.matchAll(/guid'([^']+)'/g)].map((m) => m[1]))
    return {
      value: [...byKey.values()]
        .filter((o) => !refs.size || refs.has(o.ref))
        .map((o) => ({ Ref_Key: o.ref, СтатусЗаказа: o.status, Отгрузка: o.shipment })),
    }
  })

  // The manager's side: the orders, and moving one along as 1С would.
  app.get('/manager/orders', async () => [...byKey.values()])
  app.post<{ Params: { number: string }; Body: { status?: string; shipment?: string } }>(
    '/manager/orders/:number',
    async (req, reply) => {
      const order = [...byKey.values()].find((o) => o.number === req.params.number)
      if (!order) return reply.code(404).send({ error: 'Нет такого заказа' })
      if (req.body?.status) order.status = req.body.status
      if (req.body?.shipment) order.shipment = req.body.shipment
      return order
    },
  )
  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3101)
  await buildFakeOrders().listen({ port, host: '127.0.0.1' })
  console.log(`fake 1С: orders http://localhost:${port}/hs/rvd/v1/requests`)
  console.log(`         order states http://localhost:${port}/odata`)
  console.log(`         manager http://localhost:${port}/manager/orders`)
}
