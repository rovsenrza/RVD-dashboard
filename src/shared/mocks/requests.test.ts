import { setupServer } from 'msw/node'
import type { RequestPosition, ServiceRequest } from '@/entities/types'
import type { NewRequest } from '@/shared/api/queries'
import { handlers } from './handlers'
import { storeUpload } from './attachments'
import { audit, products } from './data'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const post = async (body: Partial<NewRequest>) => {
  const res = await fetch('http://localhost/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branchId: products[0].branchId,
      productId: null,
      quantity: 0,
      comment: null,
      attachmentIds: [],
      positions: [],
      ...body,
    }),
  })
  return { status: res.status, body: (await res.json()) as ServiceRequest & { message?: string } }
}
const line = (part: Partial<RequestPosition>): RequestPosition => ({
  productId: null,
  catalogNumberId: null,
  catalogNumber: '07098-010A9',
  equipmentId: null,
  quantity: 1,
  ...part,
})
const draft = async (name: string) => {
  const stored = await storeUpload(new File(['x'], name), null, 'Иванов И.')
  if ('message' in stored) throw new Error(stored.message)
  return stored.id
}

describe('creating a request', () => {
  it('rebuilds a replacement from the hoses themselves, archive included', async () => {
    const live = products.find((p) => p.lifecycle === 'in_operation' && p.equipmentId)!
    const archived = products.find((p) => p.lifecycle === 'written_off')!
    const { status, body } = await post({
      kind: 'replace',
      // The client's copy of number and machine is not trusted: the hose decides.
      positions: [
        line({ productId: live.id, catalogNumber: 'чужой', quantity: 3 }),
        line({ productId: archived.id }),
      ],
    })
    expect(status).toBe(201)
    expect(body.positions).toEqual([
      expect.objectContaining({
        productId: live.id,
        catalogNumber: live.catalogNumber,
        equipmentId: live.equipmentId,
        quantity: 1,
      }),
      expect.objectContaining({ productId: archived.id, quantity: 1 }),
    ])
    expect(body.quantity).toBe(2)
    expect(audit[0].changes).toContainEqual({
      field: 'Изделия',
      before: null,
      after: `EHS ${live.serialNumber}, EHS ${archived.serialNumber}`,
    })
  })

  it('refuses a typed number in a replacement', async () => {
    const { status, body } = await post({ kind: 'replace', positions: [line({})] })
    expect(status).toBe(400)
    expect(body.message).toMatch(/только ваши изделия/)
  })

  it('takes manufacture or repair with no lines when an Excel file carries them', async () => {
    const { status, body } = await post({
      kind: 'manufacture',
      attachmentIds: [await draft('позиции.xlsx')],
    })
    expect(status).toBe(201)
    expect(body.positions).toEqual([])
    expect(body.attachments.map((f) => f.fileName)).toEqual(['позиции.xlsx'])

    const photoOnly = await post({ kind: 'repair', attachmentIds: [await draft('рукав.jpg')] })
    expect(photoOnly.status).toBe(400)
    expect(photoOnly.body.message).toMatch(/таблицу Excel/)
  })

  it('takes a repair with a number typed by hand, kept as text for the manager', async () => {
    const { status, body } = await post({
      kind: 'repair',
      positions: [line({ catalogNumber: 'НЕТ-В-КАТАЛОГЕ', quantity: 2 })],
    })
    expect(status).toBe(201)
    expect(body.positions[0]).toMatchObject({
      catalogNumberId: null,
      catalogNumber: 'НЕТ-В-КАТАЛОГЕ',
    })
  })

  it('caps a request at ten lines', async () => {
    const { status, body } = await post({
      kind: 'manufacture',
      positions: Array.from({ length: 11 }, () => line({})),
    })
    expect(status).toBe(400)
    expect(body.message).toMatch(/не больше 10/)
  })
})
