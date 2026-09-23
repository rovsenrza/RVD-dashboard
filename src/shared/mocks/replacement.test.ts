import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { audit, equipment, products, releaseDocuments, replacements } from './data'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const post = (body: unknown) =>
  fetch('http://localhost/api/replacements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('recording a replacement', () => {
  it('writes the old hose off and puts the new one in its place from the swap date', async () => {
    const old = products.find(
      (p) => p.installedAt && p.lifecycle !== 'written_off' && p.installPlace,
    )!
    const spare = products.find((p) => !p.installedAt && p.lifecycle !== 'written_off')!
    const machine = equipment.find((e) => e.id === old.equipmentId)!
    const hosesBefore = machine.hoseCount

    const res = await post({
      oldProductId: old.id,
      newProductId: spare.id,
      date: '2026-09-20',
      reason: 'Поломка',
      operatingHours: 2241,
      usageUnit: 'hours',
      comment: 'Потёк у фитинга',
    })

    expect(res.status).toBe(201)
    expect(replacements[0]).toMatchObject({
      oldSerialNumber: old.serialNumber,
      newSerialNumber: spare.serialNumber,
      garageNumber: machine.garageNumber,
      performedBy: 'Иванов И.',
    })
    expect(old.lifecycle).toBe('written_off')
    expect(spare).toMatchObject({
      equipmentId: machine.id,
      installPlace: old.installPlace,
      installedAt: '2026-09-20',
      replacedProductId: old.id,
      lifecycle: 'in_operation',
    })
    // One off, one on: the machine still carries as many hoses.
    expect(machine.hoseCount).toBe(hosesBefore)
    expect(releaseDocuments.filter((d) => d.productId === old.id).at(-1)?.lifecycle).toBe(
      'written_off',
    )
    expect(audit.find((e) => e.action === 'replacement.create')?.changes).toContainEqual({
      field: 'Наработка',
      before: null,
      // ru-RU groups thousands with a no-break space, as the UI shows them.
      after: `${(2241).toLocaleString('ru-RU')} м/ч`,
    })

    const again = await post({
      oldProductId: old.id,
      newProductId: null,
      date: '2026-09-21',
      reason: 'Износ',
      operatingHours: null,
      usageUnit: 'hours',
      comment: null,
    })
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ message: 'Это изделие уже снято или не установлено' })
  })
})
