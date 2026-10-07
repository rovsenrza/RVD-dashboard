// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addUser } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'
import { storeCache } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { product } from '../test/rows.ts'
import { deliverSupport, sendDigests, type Mail, type Mailer } from './mail.ts'

const TODAY = '2026-10-03'

describe.skipIf(!hasDb)('letters, once there is a mail server', () => {
  let db: Db
  let drop: () => Promise<void>
  let engineer: string
  const outbox: Mail[] = []
  let down = false
  const mailer: Mailer = {
    send: async (mail) => {
      if (down) throw new Error('SMTP недоступен')
      outbox.push(mail)
    },
  }

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
    const company = { company: 'ООО Ромашка', clientKey: 'k1' }
    engineer = await addUser(db, {
      ...company,
      name: 'Инженер',
      email: 'e@r.ru',
      password: 'инженер-пароль-1',
      role: 'engineer',
    })
    await addUser(db, {
      ...company,
      name: 'Механик',
      email: 'm@r.ru',
      password: 'механик-пароль-1',
      role: 'mechanic',
    })
    await db.query("update users set created_at = '2026-01-01'")
    // Planned 17.10.2026: the 14-days-ahead notice fires today.
    await storeCache(
      db,
      {
        products: [
          {
            product: product({
              id: 'h1',
              serialNumber: '101',
              shippedAt: '2025-10-17',
              lifecycle: 'shipped',
              warrantyDays: 180,
            }),
            clientId: 'k1',
          },
        ],
      },
      1,
    )
  })
  afterAll(async () => {
    await drop()
  })

  it('passes a message to the specialist once, and keeps it when the mail server fails', async () => {
    await db.query(
      `insert into support_messages (id, client_id, company_id, author_id, author_name, author_email,
         topic, product_id, installed_at, text)
       select 'm1', 'k1', company_id, id, name, email, 'install_date', 'h1', '2025-10-20', 'Поставили позже'
       from users where id = $1`,
      [engineer],
    )
    down = true
    expect(await deliverSupport(db, mailer, 'service@supplier.ru')).toEqual({ sent: 0, failed: 1 })
    const { rows: kept } = await db.query(
      'select delivered_at, delivery_error from support_messages',
    )
    expect(kept).toEqual([{ delivered_at: null, delivery_error: 'SMTP недоступен' }])

    down = false
    expect(await deliverSupport(db, mailer, 'service@supplier.ru')).toEqual({ sent: 1, failed: 0 })
    expect(outbox.pop()).toEqual({
      to: 'service@supplier.ru',
      subject: 'РВД Кабинет: Исправить дату установки, EHS 101',
      text: [
        'Тема: Исправить дату установки',
        'Изделие: EHS 101',
        'Верная дата установки: 20.10.2025 (в кабинете: 17.10.2025)',
        'От: Инженер <e@r.ru>, ООО Ромашка',
        '\nПоставили позже',
      ].join('\n'),
    })
    expect(await deliverSupport(db, mailer, 'service@supplier.ru')).toEqual({ sent: 0, failed: 0 })
  })

  it('sends the day’s digest only where the company allows letters and the person wants them', async () => {
    expect(await sendDigests(db, mailer, TODAY)).toBe(0)

    await db.query(`update companies set settings = '{"channels": {"inApp": true, "email": true}}'`)
    await db.query(
      `insert into notification_prefs (user_id, kinds, email)
       select id, '{}', false from users where email = 'm@r.ru'`,
    )
    expect(await sendDigests(db, mailer, TODAY, 'https://rvd.example.ru/')).toBe(1)
    const letter = outbox.pop()!
    expect(letter.to).toBe('e@r.ru')
    expect(letter.subject).toBe('РВД Кабинет: EHS 101')
    expect(letter.text).toContain(
      '• EHS 101: Плановая замена 17.10.2026 — через 14 дней. Пора заказать рукав',
    )
    expect(letter.text).toContain('https://rvd.example.ru/notifications')
    // Once a day, however often the job runs.
    expect(await sendDigests(db, mailer, TODAY)).toBe(0)
    expect(outbox).toEqual([])
  })
})
