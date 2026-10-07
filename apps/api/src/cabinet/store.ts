import { randomUUID } from 'node:crypto'
import {
  commentProblem,
  installationProblem,
  supportProblem,
  type NewSupportMessage,
  type Product,
  type ProductComment,
  type SupportMessage,
  type UserRole,
} from '@rvd/contracts'
import { AuthRejected, type Identity } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { getProduct, type Clock } from '../products/query.ts'
import { searchText } from '../sync/store.ts'

/** Whose data a call may touch and when it happens. */
export interface Scope {
  client?: string
  clock: Clock
}

const found = async (db: Db, productId: string, scope: Scope) => {
  const product = await getProduct(db, productId, scope.clock, scope.client)
  if (!product) throw new AuthRejected(404, 'Изделие не найдено')
  return product
}

/**
 * Where a hose sits and the number the customer knows it by (Д12): kept in
 * `product_local`, which every sync lays over 1С's empty fields, and written to
 * the cached hose at once so search and reports see it. The machine it is on
 * stays the supplier's until the customer says otherwise (question 14).
 */
export async function saveInstallation(
  db: Db,
  productId: string,
  patch: Record<string, unknown>,
  scope: Scope,
): Promise<{ before: Product; after: Product; garage: string | null }> {
  const problem = installationProblem(patch)
  if (problem) throw new AuthRejected(400, problem)
  const before = await found(db, productId, scope)
  if (patch.equipmentId !== undefined && patch.equipmentId !== before.equipmentId)
    throw new AuthRejected(
      409,
      'Технику, на которой стоит изделие, меняет специалист — напишите ему из карточки изделия',
    )
  const value = (key: 'installPlace' | 'clientNumber') => {
    const v = patch[key]
    if (v === undefined) return before[key]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const place = value('installPlace')
  const number = value('clientNumber')
  const garage = before.equipmentId
    ? ((
        await db.query<{ garage_number: string }>(
          'select garage_number from equipment where id = $1',
          [before.equipmentId],
        )
      ).rows[0]?.garage_number ?? null)
    : null
  const after = { ...before, installPlace: place, clientNumber: number }
  await db.query(
    `insert into product_local (product_id, client_id, install_place, client_number)
       select id, client_id, $2, $3 from products where id = $1
     on conflict (product_id) do update
       set install_place = $2, client_number = $3, updated_at = now()`,
    [productId, place, number],
  )
  await db.query(
    `update products set search = $4,
       data = data || jsonb_build_object('installPlace', $2::text, 'clientNumber', $3::text)
     where id = $1`,
    [productId, place, number, searchText(after, garage)],
  )
  return { before, after, garage }
}

interface CommentRow {
  id: string
  product_id: string
  author_id: string
  author_name: string
  author_role: UserRole
  text: string
  created_at: Date
  edited_at: Date | null
}

const toComment = (r: CommentRow): ProductComment => ({
  id: r.id,
  productId: r.product_id,
  author: { id: r.author_id, name: r.author_name, role: r.author_role },
  text: r.text,
  createdAt: r.created_at.toISOString(),
  editedAt: r.edited_at?.toISOString() ?? null,
})

/** The notes on a hose (Д11), newest first. */
export async function listComments(
  db: Db,
  productId: string,
  scope: Scope,
): Promise<ProductComment[]> {
  await found(db, productId, scope)
  const { rows } = await db.query<CommentRow>(
    'select * from product_comments where product_id = $1 order by created_at desc, id',
    [productId],
  )
  return rows.map(toComment)
}

export async function addComment(
  db: Db,
  productId: string,
  text: unknown,
  author: Identity,
  scope: Scope,
): Promise<{ comment: ProductComment; product: Product }> {
  const problem = commentProblem(text)
  if (problem) throw new AuthRejected(422, problem)
  const product = await found(db, productId, scope)
  const { rows } = await db.query<CommentRow>(
    `insert into product_comments (id, product_id, client_id, author_id, author_name, author_role, text)
       select $1, id, client_id, $3, $4, $5, $6 from products where id = $2
     returning *`,
    [randomUUID(), productId, author.userId, author.name, author.role, (text as string).trim()],
  )
  return { comment: toComment(rows[0]), product }
}

async function ownComment(db: Db, id: string, scope: Scope) {
  const { rows } = await db.query<CommentRow>(
    `select c.* from product_comments c
     where c.id = $1 and ($2::text is null or c.client_id = $2)`,
    [id, scope.client ?? null],
  )
  if (!rows[0]) throw new AuthRejected(404, 'Комментарий не найден')
  return rows[0]
}

/** Only the author changes their words. */
export async function editComment(
  db: Db,
  id: string,
  text: unknown,
  actor: Identity,
  scope: Scope,
): Promise<{ before: string; comment: ProductComment; product: Product }> {
  const problem = commentProblem(text)
  if (problem) throw new AuthRejected(422, problem)
  const row = await ownComment(db, id, scope)
  if (row.author_id !== actor.userId)
    throw new AuthRejected(403, 'Изменить можно только свой комментарий')
  const next = (text as string).trim()
  const { rows } = await db.query<CommentRow>(
    `update product_comments set text = $2,
       edited_at = case when text = $2 then edited_at else now() end
     where id = $1 returning *`,
    [id, next],
  )
  return {
    before: row.text,
    comment: toComment(rows[0]),
    product: await found(db, row.product_id, scope),
  }
}

/** The author, or an administrator moderating. */
export async function deleteComment(
  db: Db,
  id: string,
  actor: Identity,
  scope: Scope,
): Promise<{ text: string; product: Product }> {
  const row = await ownComment(db, id, scope)
  if (row.author_id !== actor.userId && actor.role !== 'admin')
    throw new AuthRejected(403, 'Удалить можно только свой комментарий')
  const product = await found(db, row.product_id, scope)
  await db.query('delete from product_comments where id = $1', [id])
  return { text: row.text, product }
}

/**
 * A message to the supplier's specialist, checked by the form's rule and kept
 * until there is a channel to pass it on (question 15: mail, 1С or a manager).
 */
export async function createSupportMessage(
  db: Db,
  body: Partial<NewSupportMessage>,
  author: Identity,
  scope: Scope,
): Promise<{ message: SupportMessage; product: Product | null }> {
  const product = body.productId
    ? await getProduct(db, body.productId, scope.clock, scope.client)
    : null
  const problem = supportProblem(body, product, scope.clock.today)
  if (problem) throw new AuthRejected(400, problem)
  const message: SupportMessage = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    topic: body.topic!,
    productId: product?.id ?? null,
    installedAt: body.topic === 'install_date' ? (body.installedAt ?? null) : null,
    text: typeof body.text === 'string' ? body.text.trim() : '',
  }
  await db.query(
    `insert into support_messages (id, client_id, company_id, author_id, author_name, author_email,
       topic, product_id, installed_at, text, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      message.id,
      scope.client ?? null,
      author.companyId,
      author.userId,
      author.name,
      author.email,
      message.topic,
      message.productId,
      message.installedAt,
      message.text,
      message.createdAt,
    ],
  )
  return { message, product }
}
