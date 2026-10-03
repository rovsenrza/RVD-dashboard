import { addDays, format, formatISO, parseISO } from 'date-fns'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { audit, products } from './data'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const send = (method: 'POST' | 'PATCH', path: string, body: unknown) =>
  fetch(`http://localhost/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const isoDay = (d: Date) => formatISO(d, { representation: 'date' })

// A hose in service, shipped long enough ago to have a day between shipment and today.
const hose = products.find(
  (p) =>
    p.lifecycle !== 'written_off' && p.shippedAt && p.shippedAt < isoDay(addDays(new Date(), -2)),
)!

describe('installation date belongs to the supplier', () => {
  it('refuses a date change from the cabinet and changes nothing', async () => {
    const was = { installedAt: hose.installedAt, lines: audit.length }
    const res = await send('PATCH', `/products/${hose.id}`, { installedAt: hose.shippedAt })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/специалист/)
    expect(hose.installedAt).toBe(was.installedAt)
    expect(audit.length).toBe(was.lines)
  })
})

describe('messages to the specialist', () => {
  it('takes a date correction with the hose and the right date, and logs it', async () => {
    const right = isoDay(addDays(parseISO(hose.shippedAt!), 1))
    const res = await send('POST', '/support/messages', {
      topic: 'install_date',
      productId: hose.id,
      installedAt: right,
      text: '',
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ topic: 'install_date', installedAt: right })
    expect(audit[0]).toMatchObject({
      action: 'support.message',
      target: { kind: 'product', id: hose.id, label: `EHS ${hose.serialNumber}` },
      changes: [
        { field: 'Тема', after: 'Исправить дату установки' },
        { field: 'Дата установки', after: format(parseISO(right), 'dd.MM.yyyy') },
      ],
    })
  })

  it('names what is wrong with a date that cannot be true', async () => {
    const ask = (installedAt: string | null, productId: string | null = hose.id) =>
      send('POST', '/support/messages', { topic: 'install_date', productId, installedAt, text: '' })
    const future = await ask(isoDay(addDays(new Date(), 1)))
    expect(future.status).toBe(400)
    expect((await future.json()).message).toMatch(/в будущем/)
    const early = await ask(isoDay(addDays(parseISO(hose.shippedAt!), -1)))
    expect((await early.json()).message).toMatch(/отгружено/)
    const noHose = await ask(hose.shippedAt, null)
    expect((await noHose.json()).message).toMatch(/Укажите изделие/)
    expect((await (await ask(null)).json()).message).toMatch(/дата установки верная/)
  })

  it('needs words for any other topic, with or without a hose', async () => {
    const empty = await send('POST', '/support/messages', {
      topic: 'request',
      productId: null,
      installedAt: null,
      text: '  ',
    })
    expect(empty.status).toBe(400)
    const res = await send('POST', '/support/messages', {
      topic: 'request',
      productId: null,
      installedAt: null,
      text: 'Когда отгрузят СВЦБ-05101?',
    })
    expect(res.status).toBe(201)
    expect(audit[0]).toMatchObject({
      action: 'support.message',
      target: { kind: 'message', label: 'Вопрос по заявке' },
    })
  })
})
