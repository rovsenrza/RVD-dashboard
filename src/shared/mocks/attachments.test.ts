// @vitest-environment node — FormData, File and fetch must come from one realm.
import { setupServer } from 'msw/node'
import type { Attachment } from '@/entities/types'
import { MAX_FILE_BYTES } from '@/entities/attachment'
import { handlers } from './handlers'
import { audit, products, requests } from './data'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const API = 'http://localhost/api'

const upload = (file: File, productId?: string) => {
  const form = new FormData()
  form.append('file', file, file.name)
  if (productId) form.append('productId', productId)
  return fetch(`${API}/attachments`, { method: 'POST', body: form })
}

const photo = (name = 'рукав.jpg') => new File(['jpeg bytes'], name, { type: 'image/jpeg' })

describe('files on a hose', () => {
  const hose = products[0]

  it('stores the file, lists it on the hose, serves it back and logs it', async () => {
    const res = await upload(photo(), hose.id)
    expect(res.status).toBe(201)
    const stored = (await res.json()) as Attachment
    expect(stored).toMatchObject({ fileName: 'рукав.jpg', kind: 'photo', uploadedBy: 'Иванов И.' })

    const list = (await (
      await fetch(`${API}/products/${hose.id}/attachments`)
    ).json()) as Attachment[]
    expect(list.map((a) => a.id)).toContain(stored.id)

    const file = await fetch(`http://localhost${stored.url}`)
    expect(file.headers.get('Content-Type')).toBe('image/jpeg')
    expect(await file.text()).toBe('jpeg bytes')

    expect(audit[0]).toMatchObject({
      action: 'attachment.create',
      target: { id: hose.id },
      changes: [{ field: 'Файлы', after: 'рукав.jpg' }],
    })
  })

  it('refuses what the limits or the antivirus do not let through', async () => {
    const exe = await upload(new File(['MZ'], 'setup.exe'), hose.id)
    expect(exe.status).toBe(422)

    const big = await upload(new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'big.png'), hose.id)
    expect(((await big.json()) as { message: string }).message).toMatch(/больше 10 МБ/)

    const eicar = new File(
      ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'],
      'акт.pdf',
    )
    const infected = await upload(eicar, hose.id)
    expect(infected.status).toBe(422)
    expect(((await infected.json()) as { message: string }).message).toMatch(/антивирус/)
  })

  it('deletes a hose file, but not one that left with a request', async () => {
    const own = (await (await upload(photo('старое.jpg'), hose.id)).json()) as Attachment
    expect((await fetch(`${API}/attachments/${own.id}`, { method: 'DELETE' })).status).toBe(204)
    expect(audit[0]).toMatchObject({ action: 'attachment.delete' })

    const draft = (await (await upload(photo('к заявке.jpg'))).json()) as Attachment
    await fetch(`${API}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'replace', quantity: 1, attachmentIds: [draft.id] }),
    })
    expect((await fetch(`${API}/attachments/${draft.id}`, { method: 'DELETE' })).status).toBe(409)
  })
})

describe('drafts claimed by a request', () => {
  it('binds the uploaded drafts to the new request and names them in the log', async () => {
    const draft = (await (await upload(photo('разрыв.jpg'))).json()) as Attachment
    const res = await fetch(`${API}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'replace',
        quantity: 1,
        attachmentIds: [draft.id, 'att-unknown'],
      }),
    })
    const created = (await res.json()) as (typeof requests)[number]
    expect(created.attachments.map((a) => a.id)).toEqual([draft.id])
    expect(created).not.toHaveProperty('attachmentIds')
    expect(audit[0].changes).toContainEqual({ field: 'Файлы', before: null, after: 'разрыв.jpg' })
  })
})
