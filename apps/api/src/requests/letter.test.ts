// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/pool.ts'
import type { Mail } from '../mail/mail.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { machine, product } from '../test/rows.ts'
import { MailOrderService } from './letter.ts'
import { deliverDue } from './outbox.ts'

/** Requests go to the manager by mail (customer, 2026-10-12), through the same outbox. */
describe.skipIf(!hasDb)('a request mailed to the manager', () => {
  let db: Db
  let drop: () => Promise<void>
  const outbox: Mail[] = []
  let down = false
  const mailer = {
    send: async (mail: Mail) => {
      if (down) throw new Error('SMTP недоступен')
      outbox.push(mail)
    },
  }
  const files = {
    put: async () => undefined,
    get: async (key: string) => (key === 'f1' ? Buffer.from('xlsx') : null),
    remove: async () => undefined,
  }

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    await storeCache(
      db,
      {
        products: [
          {
            product: product({
              id: 'h1',
              serialNumber: '000002209',
              catalogNumber: '07099-01418',
              installPlace: 'Ковш',
              equipmentId: 'e1',
            }),
            clientId: 'k1',
          },
        ],
        equipment: [{ equipment: machine('e1', { garageNumber: '4212/1' }), clientId: 'k1' }],
      },
      1,
    )
    await db.query(
      `insert into requests (id, client_id, branch_id, kind, positions, comment, author)
       values ('r1', 'k1', 'k1', 'replace', $1, 'Срочно', '{"name": "Инженер", "email": "e@r.ru"}')`,
      [
        JSON.stringify([
          {
            productId: 'h1',
            catalogNumberId: null,
            catalogNumber: null,
            equipmentId: 'e1',
            quantity: 1,
            reason: 'Поломка',
            operatingHours: 1200,
            usageUnit: 'hours',
          },
        ]),
      ],
    )
    await db.query(
      `insert into attachments (id, owner_kind, owner_id, file_name, mime_type, size, kind,
         uploaded_by, uploaded_by_id)
       values ('f1', 'request', 'r1', 'список.xlsx', 'application/vnd.ms-excel', 4, 'document', 'И', 'u')`,
    )
  })
  afterAll(async () => drop())

  const service = () => new MailOrderService(db, mailer, 'orders@supplier.ru', files)

  it('keeps it queued while the mail server is down', async () => {
    down = true
    expect(await deliverDue(db, service())).toMatchObject({ postponed: 1 })
    down = false
  })

  it('mails what the manager needs, with the files, and leaves no 1С number', async () => {
    expect(await deliverDue(db, service(), new Date(Date.now() + 3_600_000))).toMatchObject({
      delivered: 1,
    })
    const [letter] = outbox
    expect(letter).toMatchObject({ to: 'orders@supplier.ru', replyTo: 'e@r.ru' })
    expect(letter.subject).toContain('заявка «Замена»')
    expect(letter.text).toContain(
      '1. взамен изделия № 000002209, каталожный № 07099-01418, техника 4212/1, место: Ковш, кол-во 1, причина: Поломка, наработка 1200',
    )
    expect(letter.text).toContain('Комментарий: Срочно')
    expect(letter.attachments).toEqual([{ filename: 'список.xlsx', content: Buffer.from('xlsx') }])
    const { rows } = await db.query('select delivery, number, onec_ref, status from requests')
    expect(rows).toEqual([{ delivery: 'delivered', number: null, onec_ref: null, status: 'new' }])
  })
})
