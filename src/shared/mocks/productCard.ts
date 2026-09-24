import { addDays, formatISO, parseISO, setHours, subDays } from 'date-fns'
import type {
  Attachment,
  AuditChange,
  Product,
  ProductComment,
  ProductLifetime,
} from '@/entities/types'
import { COMMENT_MAX } from '@/entities/comment'
import { currentUser, products, record, replacements, settings, users } from './data'

const day = (d: Date) => formatISO(d, { representation: 'date' })
const plus = (iso: string, days: number) => day(addDays(parseISO(iso), days))

// ── Срок службы ─────────────────────────────────────────────────────────────

/**
 * The phases in the order the status rule applies them: «Внимание» takes over
 * from the warranty when both would hold, so a long warranty never hides it.
 */
export function productLifetime(p: Product): ProductLifetime | null {
  if (!p.installedAt) return null
  const from = p.installedAt
  const warrantyUntil = plus(from, p.warrantyDays)
  const warnFrom = plus(from, Math.round(p.serviceLifeDays * (1 - settings.warnPercent / 100)))
  const plannedAt = plus(from, p.serviceLifeDays)
  const swap =
    p.lifecycle === 'written_off' ? replacements.find((r) => r.oldProductId === p.id) : null
  const endedAt = swap ? (swap.date < from ? from : swap.date) : null
  const okUntil = warrantyUntil < warnFrom ? warrantyUntil : warnFrom
  return {
    installedAt: from,
    endedAt,
    warrantyUntil,
    plannedAt,
    phases: [
      { status: 'ok', from, to: okUntil },
      ...(warrantyUntil < warnFrom
        ? [{ status: 'no_warranty' as const, from: warrantyUntil, to: warnFrom }]
        : []),
      { status: 'warn', from: warnFrom, to: plannedAt },
      { status: 'replace', from: plannedAt, to: null },
    ],
  }
}

// ── Техническая документация из 1С ──────────────────────────────────────────

const DOC_KINDS = [
  { key: 'passport', title: 'Паспорт РВД', latin: 'hose passport' },
  { key: 'drawing', title: 'Чертёж сборки', latin: 'assembly drawing' },
  {
    key: 'certificate',
    title: 'Сертификат соответствия ТР ТС',
    latin: 'certificate of conformity',
  },
] as const

/**
 * A one-page PDF in plain Latin (the base-14 fonts carry no Cyrillic), honest
 * about being a stand-in for the file 1С will serve.
 */
function demoPdf(lines: string[]): Uint8Array {
  const esc = (t: string) => t.replace(/[\\()]/g, (m) => `\\${m}`)
  const text = lines.map((l, i) => `${i ? 'T* ' : ''}(${esc(l)}) Tj`).join('\n')
  const content = `BT\n/F1 13 Tf\n56 780 Td\n20 TL\n${text}\nET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((o, i) => {
    const at = pdf.length
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

const docFile = (catalog: string, kind: (typeof DOC_KINDS)[number]) =>
  demoPdf([
    'RVD Kabinet - demo document',
    '',
    `Catalog number: ${catalog}`,
    `Document: ${kind.latin}`,
    '',
    'This file stands in for the technical documentation',
    'that the cabinet will take from 1C (BSP files)',
    'once access to OData is in place.',
  ])

/** Documentation belongs to the catalogue number (типоразмер), so every hose of it shares one set. */
export function documentationOf(p: Product): Attachment[] {
  if (!p.catalogNumberId || !p.catalogNumber) return []
  return DOC_KINDS.map((kind) => {
    const id = `${p.catalogNumberId}.${kind.key}`
    const url = `/api/documentation/${id}/file`
    return {
      id,
      fileName: `${kind.title} ${p.catalogNumber}.pdf`,
      mimeType: 'application/pdf',
      size: docFile(p.catalogNumber!, kind).length,
      kind: 'document',
      url,
      previewUrl: null,
      uploadedAt: `${p.manufacturedAt}T09:00:00.000Z`,
      uploadedBy: '1С',
    }
  })
}

export function documentationFile(id: string): Uint8Array | null {
  const [catalogId, key] = id.split('.')
  const kind = DOC_KINDS.find((k) => k.key === key)
  const p = products.find((x) => x.catalogNumberId === catalogId)
  return kind && p?.catalogNumber ? docFile(p.catalogNumber, kind) : null
}

// ── Комментарии ─────────────────────────────────────────────────────────────

const NOTES = [
  'Осмотрел при ТО: потёртость оплётки у муфты, пока в пределах нормы. Проверить через месяц.',
  'Рукав трётся о раму стрелы — поставили защитную спираль.',
  'Течь по фитингу устранили подтяжкой, наработка на момент осмотра 2 240 м/ч.',
  'Согласовано с механиком участка: меняем в плановый ремонт вместе с соседним РВД.',
  'Фото повреждения добавил в «Фото и документы».',
  'Давление в контуре в норме, перегибов нет.',
  'Заказчик просит держать запасной рукав этого номера на складе участка.',
]

// A separate generator, so seeding notes never shifts the rest of the mock data.
let noteSeed = 7
const noteRand = () => {
  noteSeed = (noteSeed * 48271) % 2147483647
  return (noteSeed - 1) / 2147483646
}

const toView = (text: string) => (text.length > 140 ? `${text.slice(0, 139)}…` : text)
const authorOf = (u = currentUser()) => ({ id: u.id, name: u.name, role: u.role })

export const comments: ProductComment[] = products
  .filter((p, i) => p.installedAt && i % 3 === 0)
  .flatMap((p) => {
    const count = 1 + Math.floor(noteRand() * 3)
    return Array.from({ length: count }, (_, k) => {
      const at = setHours(subDays(new Date(), 3 + Math.floor(noteRand() * 50) + k * 9), 9 + k * 3)
      return {
        id: `c-${p.id}-${k + 1}`,
        productId: p.id,
        author: authorOf(users[Math.floor(noteRand() * users.length)]),
        text: NOTES[Math.floor(noteRand() * NOTES.length)],
        createdAt: at.toISOString(),
        editedAt: null,
      }
    })
  })

let commentSeq = 0

export const commentsOf = (productId: string) =>
  comments
    .filter((c) => c.productId === productId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/** Why this text cannot be saved, or null. */
export const commentProblem = (text: unknown) =>
  typeof text !== 'string' || !text.trim()
    ? 'Комментарий пустой'
    : text.length > COMMENT_MAX
      ? `Комментарий длиннее ${COMMENT_MAX} знаков — сократите его`
      : null

const target = (p: Product) => ({
  kind: 'product' as const,
  id: p.id,
  label: `EHS ${p.serialNumber}`,
})
const change = (before: string | null, after: string | null): AuditChange[] => [
  { field: 'Комментарий', before: before && toView(before), after: after && toView(after) },
]

export function addComment(p: Product, text: string): ProductComment {
  const c: ProductComment = {
    id: `c-new-${++commentSeq}`,
    productId: p.id,
    author: authorOf(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
    editedAt: null,
  }
  comments.push(c)
  record({ action: 'comment.create', target: target(p), changes: change(null, c.text) })
  return c
}

/** Only the author edits their words; the BFF checks it against the token. */
export function editComment(c: ProductComment, text: string): ProductComment | 'forbidden' {
  if (c.author.id !== users[0].id) return 'forbidden'
  const before = c.text
  if (before === text.trim()) return c
  c.text = text.trim()
  c.editedAt = new Date().toISOString()
  const p = products.find((x) => x.id === c.productId)!
  record({ action: 'comment.update', target: target(p), changes: change(before, c.text) })
  return c
}

/** The author, or an administrator moderating; the mock cannot see the demo role, the BFF will. */
export function deleteComment(c: ProductComment) {
  comments.splice(comments.indexOf(c), 1)
  const p = products.find((x) => x.id === c.productId)!
  record({ action: 'comment.delete', target: target(p), changes: change(c.text, null) })
}
