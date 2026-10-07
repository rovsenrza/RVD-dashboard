// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { DEFAULT_RULES, type Attachment, type ServiceRequest } from '@rvd/contracts'
import { buildApp } from '../app.ts'
import { addUser } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { product } from '../test/rows.ts'
import { purgeDrafts } from './attachments.ts'
import { memoryStore } from './storage.ts'

const SECRET = 'a-test-secret-that-is-long-enough-1234567890'
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

describe.skipIf(!hasDb)('files on the server', () => {
  let db: Db
  let drop: () => Promise<void>
  let app: ReturnType<typeof buildApp>
  let mine: string
  let colleague: string
  let stranger: string
  let photo: Buffer
  const store = memoryStore()

  const upload = (token: string, fileName: string, data: Buffer, productId?: string) => {
    const form = new FormData()
    if (productId) form.append('productId', productId)
    form.append('file', new Blob([new Uint8Array(data)]), fileName)
    return app.inject({
      method: 'POST',
      url: '/attachments',
      payload: form,
      headers: { authorization: `Bearer ${token}` },
    })
  }
  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, token?: string, payload?: object) =>
    app.inject({
      method,
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  /** The path the API serves, from the link it gave (`/api/…` as the browser reaches it). */
  const served = (link: string) => link.replace(/^\/api/, '')

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    for (const [name, email, client] of [
      ['Иванов Иван', 'i@r.ru', 'k1'],
      ['Петров Пётр', 'p@r.ru', 'k1'],
      ['Чужой', 'x@l.ru', 'k2'],
    ] as const)
      await addUser(db, {
        company: client === 'k1' ? 'ООО Ромашка' : 'ООО Лютик',
        clientKey: client,
        name,
        email,
        password: 'пароль-пароль-1',
        role: 'engineer',
      })
    await storeCache(
      db,
      {
        products: [
          {
            product: product({ id: 'h1', serialNumber: '101', shippedAt: '2026-05-01' }),
            clientId: 'k1',
          },
        ],
      },
      1,
    )
    app = buildApp({
      logLevel: 'silent',
      db,
      clock: () => ({ today: '2026-10-03', rules: DEFAULT_RULES }),
      auth: { secret: SECRET },
      files: { store },
    })
    const signIn = async (email: string) =>
      (
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email, password: 'пароль-пароль-1' },
        })
      ).json().accessToken as string
    mine = await signIn('i@r.ru')
    colleague = await signIn('p@r.ru')
    stranger = await signIn('x@l.ru')
    photo = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: '#ffcc00' },
    })
      .png()
      .toBuffer()
  })
  afterAll(async () => {
    await app.close()
    await drop()
  })

  it('keeps a photo on a hose with a reduced copy, behind links that carry their own permission', async () => {
    const res = await upload(mine, 'рукав.png', photo, 'h1')
    expect(res.statusCode).toBe(201)
    const file = res.json() as Attachment
    expect(file).toMatchObject({
      fileName: 'рукав.png',
      mimeType: 'image/png',
      kind: 'photo',
      size: photo.length,
      uploadedBy: 'Иванов И.',
    })
    expect(file.url).toMatch(/^\/api\/attachments\/.+\/file\?exp=\d+&sig=/)
    expect((await call('GET', '/products/h1/attachments', mine)).json()).toEqual([file])

    // An <img> sends no token: the signed link alone opens the file.
    const original = await call('GET', served(file.url))
    expect(original.statusCode).toBe(200)
    expect(original.headers['content-type']).toBe('image/png')
    const preview = await call('GET', served(file.previewUrl!))
    expect(preview.headers['content-type']).toBe('image/webp')
    expect(await sharp(preview.rawPayload).metadata()).toMatchObject({ width: 480, height: 360 })

    expect((await call('GET', served(file.url).replace(/sig=.+$/, 'sig=forged'))).statusCode).toBe(
      401,
    )
    // Another company's token does not reach it either.
    expect((await call('GET', `/attachments/${file.id}/file`, stranger)).statusCode).toBe(404)
    expect((await call('GET', '/products/h1/attachments', stranger)).statusCode).toBe(404)
  })

  it('refuses what the extension lies about and what the antivirus catches', async () => {
    const lie = await upload(mine, 'акт.pdf', photo, 'h1')
    expect(lie.statusCode).toBe(422)
    expect(lie.json().message).toBe('«акт.pdf»: содержимое не похоже на PDF')
    const virus = await upload(mine, 'акт.pdf', Buffer.from(`%PDF-1.4\n${EICAR}`), 'h1')
    expect(virus.statusCode).toBe(422)
    expect(virus.json().message).toMatch(/не прошёл проверку антивирусом/)
    expect((await upload(mine, 'setup.exe', Buffer.from('MZ'), 'h1')).statusCode).toBe(422)
  })

  it('lets a request claim its form’s drafts — the uploader’s own only — and keeps them', async () => {
    const xlsx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)])
    const own = (await upload(mine, 'список.xlsx', xlsx)).json() as Attachment
    const theirs = (await upload(colleague, 'чужой.xlsx', xlsx)).json() as Attachment
    // «Изготовление» by an Excel file alone, no lines: the file the server holds counts.
    const res = await call('POST', '/requests', mine, {
      branchId: 'b1',
      kind: 'manufacture',
      positions: [],
      comment: null,
      attachmentIds: [own.id, theirs.id],
    })
    expect(res.statusCode).toBe(201)
    const created = res.json() as ServiceRequest
    expect(created.attachments.map((a) => a.fileName)).toEqual(['список.xlsx'])
    const listed = (await call('GET', '/requests', mine)).json() as ServiceRequest[]
    expect(listed[0].attachments.map((a) => a.id)).toEqual([own.id])

    // A request's files went to 1С with it: they stay.
    const kept = await call('DELETE', `/attachments/${own.id}`, mine)
    expect(kept.statusCode).toBe(409)

    // A draft nobody claimed goes after a day.
    await db.query("update attachments set uploaded_at = now() - interval '2 days' where id = $1", [
      theirs.id,
    ])
    expect(await purgeDrafts(db, store)).toBe(1)
    expect(await store.get(theirs.id)).toBeNull()
  })

  it('removes a hose’s file and logs it', async () => {
    const [file] = (await call('GET', '/products/h1/attachments', mine)).json() as Attachment[]
    expect((await call('DELETE', `/attachments/${file.id}`, mine)).statusCode).toBe(204)
    expect((await call('GET', '/products/h1/attachments', mine)).json()).toEqual([])
    expect(await store.get(file.id)).toBeNull()
    const { rows } = await db.query<{ action: string }>(
      'select action from audit_log order by id desc limit 2',
    )
    expect(rows.map((r) => r.action)).toEqual(['attachment.delete', 'request.create'])
  })
})
