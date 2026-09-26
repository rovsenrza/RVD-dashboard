// @vitest-environment node — fetch and Response bodies from one realm.
import { setupServer } from 'msw/node'
import type { ProductComment, ProductLifetime } from '@/entities/types'
import { COMMENT_MAX } from '@/entities/comment'
import { handlers } from './handlers'
import { audit, products, users } from './data'
import { comments, productLifetime } from './productCard'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const API = 'http://localhost/api'
const send = (path: string, method: string, body?: unknown) =>
  fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe('service life', () => {
  it('runs warranty → after warranty → attention → replacement, back to back', () => {
    const p = products.find((x) => x.installedAt && x.warrantyDays < x.serviceLifeDays * 0.8)!
    const life = productLifetime(p)!
    expect(life.phases.map((x) => x.status)).toEqual(['ok', 'no_warranty', 'warn', 'replace'])
    for (let i = 1; i < life.phases.length; i++)
      expect(life.phases[i].from).toBe(life.phases[i - 1].to)
    expect(life.phases.at(-1)!.to).toBeNull()
    expect(life.phases.at(-1)!.from).toBe(life.plannedAt)
  })

  it('counts from shipment for a hose that was never installed', async () => {
    const stock = products.find((x) => !x.installedAt)!
    const life = (await (
      await fetch(`${API}/products/${stock.id}/lifetime`)
    ).json()) as ProductLifetime
    expect(life).toMatchObject({ startedAt: stock.shippedAt, basis: 'shipped' })
  })

  it('ends a written-off hose on the day it came off', async () => {
    const off = products.find((x) => x.lifecycle === 'written_off' && x.installedAt)!
    const life = (await (
      await fetch(`${API}/products/${off.id}/lifetime`)
    ).json()) as ProductLifetime
    expect(life.endedAt).not.toBeNull()
  })
})

describe('documentation from 1С', () => {
  it('lists the catalogue number documents and serves each as a PDF', async () => {
    const p = products.find((x) => x.catalogNumber)!
    const docs = (await (await fetch(`${API}/products/${p.id}/documentation`)).json()) as {
      fileName: string
      url: string
      size: number
    }[]
    expect(docs.map((d) => d.fileName)).toContain(`Паспорт РВД ${p.catalogNumber}.pdf`)
    const file = await fetch(`http://localhost${docs[0].url}`)
    const bytes = new Uint8Array(await file.arrayBuffer())
    expect(file.headers.get('Content-Type')).toBe('application/pdf')
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe('%PDF-1.4')
    expect(bytes.length).toBe(docs[0].size)
  })
})

describe('comments', () => {
  const hose = products.find((x) => x.installedAt)!

  it('adds, edits and deletes a note, logging each step', async () => {
    const created = (await (
      await send(`/products/${hose.id}/comments`, 'POST', { text: '  Проверил хомуты.  ' })
    ).json()) as ProductComment
    expect(created).toMatchObject({ text: 'Проверил хомуты.', author: { id: users[0].id } })
    expect(audit[0]).toMatchObject({ action: 'comment.create', target: { id: hose.id } })

    const list = (await (
      await fetch(`${API}/products/${hose.id}/comments`)
    ).json()) as ProductComment[]
    expect(list[0].id).toBe(created.id)

    const edited = (await (
      await send(`/comments/${created.id}`, 'PATCH', { text: 'Проверил хомуты, подтянул.' })
    ).json()) as ProductComment
    expect(edited.editedAt).not.toBeNull()
    expect(audit[0].changes[0]).toMatchObject({
      before: 'Проверил хомуты.',
      after: 'Проверил хомуты, подтянул.',
    })

    expect((await send(`/comments/${created.id}`, 'DELETE')).status).toBe(204)
    expect(audit[0]).toMatchObject({ action: 'comment.delete' })
  })

  it('refuses empty or overlong text, and editing someone else’s note', async () => {
    expect((await send(`/products/${hose.id}/comments`, 'POST', { text: '   ' })).status).toBe(422)
    const long = 'а'.repeat(COMMENT_MAX + 1)
    expect((await send(`/products/${hose.id}/comments`, 'POST', { text: long })).status).toBe(422)
    const theirs = comments.find((c) => c.author.id !== users[0].id)!
    expect((await send(`/comments/${theirs.id}`, 'PATCH', { text: 'правка' })).status).toBe(403)
  })
})
