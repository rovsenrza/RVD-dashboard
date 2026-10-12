import { REQUEST_KIND_LABEL, USAGE_UNIT_LABEL, type RequestPosition } from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import type { FileStore } from '../files/storage.ts'
import type { Mailer } from '../mail/mail.ts'
import type { OrderPayload, OrderResult, OrderService } from '../onec/orders.ts'

/** A letter's files together stay under what mail servers usually take. */
const ATTACH_LIMIT = 15 * 1024 * 1024

/** «Ковш, рукоять» — what the manager needs to know about one line. */
interface LineFacts {
  serial: string | null
  catalog: string | null
  garage: string | null
  place: string | null
}

/**
 * Requests go to the supplier's manager by mail (customer, 2026-10-12): the
 * manager reads the letter and makes the order in 1С by hand; nothing is
 * created in 1С automatically. It plugs into the same outbox as the 1С
 * service did, so a letter the mail server refuses is tried again later.
 * The order the manager makes shows up in «Заявки» as «Заказ в 1С» at sync.
 */
export class MailOrderService implements OrderService {
  private readonly db: Db
  private readonly mailer: Mailer
  private readonly to: string
  private readonly files?: FileStore

  constructor(db: Db, mailer: Mailer, to: string, files?: FileStore) {
    this.db = db
    this.mailer = mailer
    this.to = to
    this.files = files
  }

  async create(payload: OrderPayload): Promise<OrderResult> {
    const { rows } = await this.db.query<{
      positions: RequestPosition[]
      client_name: string | null
      company: string | null
      created_at: Date
    }>(
      `select r.positions, b.name as client_name, c.name as company, r.created_at
       from requests r
       left join company_branches b on b.client_key = r.client_id
       left join companies c on c.id = b.company_id
       where r.id = $1`,
      [payload.cabinetId],
    )
    const r = rows[0]
    if (!r) throw new Error(`Заявка ${payload.cabinetId} не найдена`)
    const facts = await this.lineFacts(r.positions)
    const files = await this.attachments(payload.cabinetId)

    const lines = r.positions.map((p, i) => {
      const f = facts[i]
      const usage =
        p.operatingHours != null
          ? `наработка ${p.operatingHours} ${USAGE_UNIT_LABEL[p.usageUnit ?? 'hours']}`
          : null
      return [
        `${i + 1}.`,
        f.serial ? `взамен изделия № ${f.serial}` : null,
        `каталожный № ${p.catalogNumber ?? f.catalog ?? '—'}`,
        f.garage ? `техника ${f.garage}` : null,
        f.place ? `место: ${f.place}` : null,
        `кол-во ${p.quantity}`,
        p.reason ? `причина: ${p.reason}` : null,
        usage,
      ]
        .filter(Boolean)
        .join(', ')
    })
    const client = r.client_name ?? r.company ?? payload.client
    await this.mailer.send({
      to: this.to,
      replyTo: payload.author.email ?? undefined,
      subject: `РВД Кабинет: заявка «${REQUEST_KIND_LABEL[payload.kind]}» — ${client}`,
      text: [
        `Тип: ${REQUEST_KIND_LABEL[payload.kind]}`,
        `Клиент: ${client}${r.company && r.company !== client ? ` (${r.company})` : ''}`,
        `От: ${payload.author.name}${payload.author.email ? ` <${payload.author.email}>` : ''}`,
        `Создана: ${r.created_at.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
        '',
        'Позиции:',
        ...(lines.length ? lines : ['— (по приложенной таблице)']),
        ...(payload.comment ? ['', `Комментарий: ${payload.comment}`] : []),
        ...(files.skipped.length
          ? ['', `Не вложены из-за размера (есть в кабинете): ${files.skipped.join(', ')}`]
          : []),
        '',
        'Заказ оформляется в 1С вручную; после этого он появится у клиента в разделе «Заявки».',
      ].join('\n'),
      attachments: files.attached,
    })
    // No order exists yet: the cabinet keeps no 1С key or number for this request.
    return { ref: '', number: '', status: 'Черновик' }
  }

  /** The hose, machine and place each line names, from the cache. */
  private async lineFacts(positions: RequestPosition[]): Promise<LineFacts[]> {
    const products = positions.map((p) => p.productId).filter((id): id is string => !!id)
    const machines = positions.map((p) => p.equipmentId).filter((id): id is string => !!id)
    const [hoses, garages] = await Promise.all([
      this.db.query<{ id: string; serial: string; catalog: string | null; place: string | null }>(
        `select id, serial_number as serial, data->>'catalogNumber' as catalog,
           data->>'installPlace' as place
         from products where id = any($1)`,
        [products],
      ),
      this.db.query<{ id: string; garage: string }>(
        'select id, garage_number as garage from equipment where id = any($1)',
        [machines],
      ),
    ])
    const hose = new Map(hoses.rows.map((h) => [h.id, h]))
    const garage = new Map(garages.rows.map((g) => [g.id, g.garage]))
    return positions.map((p) => {
      const h = p.productId ? hose.get(p.productId) : undefined
      return {
        serial: h?.serial ?? null,
        catalog: h?.catalog ?? null,
        garage: p.equipmentId ? (garage.get(p.equipmentId) ?? null) : null,
        place: h?.place ?? null,
      }
    })
  }

  /** The request's files as attachments, as many as fit; the rest are named in the text. */
  private async attachments(requestId: string) {
    const attached: { filename: string; content: Buffer }[] = []
    const skipped: string[] = []
    if (!this.files) return { attached, skipped }
    const { rows } = await this.db.query<{ id: string; file_name: string; size: number }>(
      `select id, file_name, size from attachments
       where owner_kind = 'request' and owner_id = $1 order by uploaded_at`,
      [requestId],
    )
    let total = 0
    for (const f of rows) {
      const data = total + f.size <= ATTACH_LIMIT ? await this.files.get(f.id) : null
      if (data) {
        attached.push({ filename: f.file_name, content: data })
        total += f.size
      } else skipped.push(f.file_name)
    }
    return { attached, skipped }
  }
}
