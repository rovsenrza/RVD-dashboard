import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import {
  fileFormat,
  fileProblem,
  MAX_FILES,
  signatureMatches,
  tooManyFiles,
  type Attachment,
  type Product,
} from '@rvd/contracts'
import { AuthRejected, type Identity } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { getProduct, type Clock } from '../products/query.ts'
import type { FileStore, FileVariant, Scanner } from './storage.ts'

/** What a file belongs to. A draft (no owner) waits for the request that claims it. */
export interface Owner {
  kind: 'product' | 'request'
  id: string
}

interface Row {
  id: string
  client_id: string | null
  owner_kind: Owner['kind'] | null
  owner_id: string | null
  file_name: string
  mime_type: string
  size: number
  kind: Attachment['kind']
  has_preview: boolean
  uploaded_at: Date
  uploaded_by: string
  uploaded_by_id: string
}

/** «Иванов И.» — the way journals name people. */
const shortName = (name: string) => {
  const [last, first] = name.trim().split(/\s+/)
  return first ? `${last} ${first[0]}.` : last
}

const DRAFT_DAYS = 1
const PREVIEW = 480

export interface Links {
  link: (id: string, variant: FileVariant) => string
}

/**
 * Files (Д25): checked by the form's rule, by their own first bytes and by the
 * antivirus before anything is kept; photos get a reduced copy for the
 * thumbnails. Links carry their own permission, since an <img> sends no token.
 */
export function createFiles(db: Db, store: FileStore, scan: Scanner, links: Links) {
  const toAttachment = (r: Row): Attachment => ({
    id: r.id,
    fileName: r.file_name,
    mimeType: r.mime_type,
    size: r.size,
    kind: r.kind,
    url: links.link(r.id, 'file'),
    previewUrl: r.has_preview ? links.link(r.id, 'preview') : null,
    uploadedAt: r.uploaded_at.toISOString(),
    uploadedBy: r.uploaded_by,
  })

  const owned = async (owner: Owner) =>
    (
      await db.query<Row>(
        `select * from attachments where owner_kind = $1 and owner_id = $2
         order by uploaded_at desc, id`,
        [owner.kind, owner.id],
      )
    ).rows

  const preview = async (data: Buffer) =>
    sharp(data)
      .rotate()
      .resize(PREVIEW, PREVIEW, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer()
      .catch(() => null)

  return {
    /** Keeps an upload, on a hose at once or as a draft for a request form. */
    async upload(input: {
      fileName: string
      data: Buffer
      productId: string | null
      uploader: Identity
      client?: string
      clock: Clock
    }): Promise<{ attachment: Attachment; product: Product | null }> {
      const { fileName, data } = input
      const problem = fileProblem({ name: fileName, size: data.length })
      if (problem) throw new AuthRejected(422, problem)
      const format = fileFormat(fileName)!
      if (!signatureMatches(format, data))
        throw new AuthRejected(422, `«${fileName}»: содержимое не похоже на ${format.label}`)
      const product = input.productId
        ? await getProduct(db, input.productId, input.clock, input.client)
        : null
      if (input.productId && !product) throw new AuthRejected(404, 'Изделие не найдено')
      if (product && (await owned({ kind: 'product', id: product.id })).length >= MAX_FILES)
        throw new AuthRejected(422, tooManyFiles(fileName))
      const verdict = await scan(data).catch(() => {
        throw new AuthRejected(409, 'Антивирус сейчас недоступен — попробуйте приложить файл позже')
      })
      if (verdict === 'infected')
        throw new AuthRejected(422, `«${fileName}» не прошёл проверку антивирусом и не сохранён`)

      const id = randomUUID()
      await store.put(id, data)
      const reduced = format.kind === 'photo' ? await preview(data) : null
      if (reduced) await store.put(`${id}.preview`, reduced)
      const { rows } = await db.query<Row>(
        `insert into attachments (id, client_id, owner_kind, owner_id, file_name, mime_type, size,
           kind, has_preview, uploaded_by, uploaded_by_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
        [
          id,
          input.client ?? null,
          product ? 'product' : null,
          product?.id ?? null,
          fileName,
          format.mime,
          data.length,
          format.kind,
          reduced !== null,
          shortName(input.uploader.name),
          input.uploader.userId,
        ],
      )
      return { attachment: toAttachment(rows[0]), product }
    },

    /** A hose's files, newest first; the hose must be in the asker's scope. */
    async ofProduct(productId: string, client: string | undefined, clock: Clock) {
      if (!(await getProduct(db, productId, clock, client)))
        throw new AuthRejected(404, 'Изделие не найдено')
      return (await owned({ kind: 'product', id: productId })).map(toAttachment)
    },

    /** The bytes and what they are; `client` narrows to the asker's (a signed link needs none). */
    async read(id: string, variant: FileVariant, client?: string) {
      const { rows } = await db.query<Row>(
        'select * from attachments where id = $1 and ($2::text is null or client_id = $2)',
        [id, client ?? null],
      )
      const row = rows[0]
      if (!row || (variant === 'preview' && !row.has_preview)) return null
      const data = await store.get(variant === 'preview' ? `${id}.preview` : id)
      return data
        ? {
            data,
            fileName: row.file_name,
            mimeType: variant === 'preview' ? 'image/webp' : row.mime_type,
          }
        : null
    },

    /** A hose's file; a request's went to 1С with it and stays as evidence. */
    async remove(id: string, client: string | undefined, clock: Clock) {
      const { rows } = await db.query<Row>(
        'select * from attachments where id = $1 and ($2::text is null or client_id = $2)',
        [id, client ?? null],
      )
      const row = rows[0]
      if (!row) throw new AuthRejected(404, 'Файл не найден')
      if (row.owner_kind !== 'product')
        throw new AuthRejected(409, 'Файлы заявок уходят в 1С вместе с ними и не удаляются')
      const product = await getProduct(db, row.owner_id!, clock, client)
      if (!product) throw new AuthRejected(404, 'Файл не найден')
      await db.query('delete from attachments where id = $1', [id])
      await store.remove(id)
      await store.remove(`${id}.preview`)
      return { fileName: row.file_name, product }
    },

    /** The uploader's own unclaimed drafts among `ids`, for a request about to be created. */
    async drafts(ids: unknown, uploaderId: string) {
      const wanted = Array.isArray(ids) ? ids.filter((i): i is string => typeof i === 'string') : []
      if (!wanted.length) return []
      const { rows } = await db.query<Row>(
        `select * from attachments
         where id = any($1) and owner_kind is null and uploaded_by_id = $2 order by uploaded_at`,
        [wanted, uploaderId],
      )
      return rows.map(toAttachment)
    },

    /** Binds drafts to the record just created. */
    async claim(ids: string[], owner: Owner) {
      if (!ids.length) return []
      const { rows } = await db.query<Row>(
        `update attachments set owner_kind = $2, owner_id = $3
         where id = any($1) and owner_kind is null returning *`,
        [ids, owner.kind, owner.id],
      )
      return rows.map(toAttachment)
    },

    /** Files of several requests at once, for the request list. */
    async ofRequests(ids: string[]): Promise<Map<string, Attachment[]>> {
      const out = new Map<string, Attachment[]>()
      if (!ids.length) return out
      const { rows } = await db.query<Row>(
        `select * from attachments where owner_kind = 'request' and owner_id = any($1)
         order by uploaded_at`,
        [ids],
      )
      for (const r of rows) out.set(r.owner_id!, [...(out.get(r.owner_id!) ?? []), toAttachment(r)])
      return out
    },

    /** Drafts a form never claimed: gone after a day, bytes and all. */
    purgeDrafts: () => purgeDrafts(db, store),
  }
}

export type Files = ReturnType<typeof createFiles>

/** Drafts a form never claimed: gone after a day, bytes and all. */
export async function purgeDrafts(db: Db, store: FileStore): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    `delete from attachments where owner_kind is null
       and uploaded_at < now() - interval '${DRAFT_DAYS} day' returning id`,
  )
  for (const { id } of rows) {
    await store.remove(id)
    await store.remove(`${id}.preview`)
  }
  return rows.length
}
