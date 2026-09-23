import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { audit, diff, products, settings } from './data'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const patch = (path: string, body: unknown) =>
  fetch(`http://localhost/api${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('action log', () => {
  it('keeps only the fields that changed', () => {
    expect(diff({ a: '1', b: '2' }, { a: '1', b: '3' })).toEqual([
      { field: 'b', before: '2', after: '3' },
    ])
  })

  it('records an installation change with the field as it was and as it became', async () => {
    // A hose beyond the seeded history, so this is its only log line.
    const hose = products.filter((p) => p.equipmentId && p.installPlace !== 'Ковш').at(-1)!
    const before = hose.installPlace
    await patch(`/products/${hose.id}`, { installPlace: 'Ковш' })
    const lines = audit.filter((e) => e.target.id === hose.id)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      action: 'installation.update',
      actor: { name: 'Иванов Иван' },
      target: { kind: 'product', label: `EHS ${hose.serialNumber}` },
      changes: [{ field: 'Место установки', before, after: 'Ковш' }],
    })
  })

  it('writes nothing when a save changes nothing', async () => {
    const size = audit.length
    await patch('/admin/settings', { warnPercent: settings.warnPercent })
    expect(audit).toHaveLength(size)
  })
})
