import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import Fastify from 'fastify'

/**
 * A stand-in for the 1С order service of docs/1c/request-api.md until the real
 * one exists: same route, same answers (201 with a «СВЦБ-…» number, the same
 * order again for a repeated Idempotency-Key, 422 with a reason). Run it with
 * `npm run fake-1c -w @rvd/api` and set
 * ONEC_ORDERS_URL=http://localhost:3101/hs/rvd/v1/requests.
 */
export function buildFakeOrders() {
  const app = Fastify({ logger: false })
  const orders = new Map<string, { ref: string; number: string; status: string }>()
  let seq = 2200
  app.post('/hs/rvd/v1/requests', async (req, reply) => {
    const key = req.headers['idempotency-key']
    if (typeof key !== 'string' || !key)
      return reply.code(422).send({ error: 'Нет Idempotency-Key' })
    const known = orders.get(key)
    if (known) return reply.code(200).send(known)
    const body = req.body as { client?: string; lines?: unknown[] } | undefined
    if (!body?.client || !Array.isArray(body.lines))
      return reply.code(422).send({ error: 'В заявке нет клиента или строк' })
    const order = {
      ref: randomUUID(),
      number: `СВЦБ-${String(++seq).padStart(6, '0')}`,
      status: 'Черновик',
    }
    orders.set(key, order)
    return reply.code(201).send(order)
  })
  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3101)
  await buildFakeOrders().listen({ port, host: '127.0.0.1' })
  console.log(`fake 1С orders: http://localhost:${port}/hs/rvd/v1/requests`)
}
