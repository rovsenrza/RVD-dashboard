// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/pool.ts'
import type { Discrepancy } from '../onec/adapters/discrepancies.ts'
import { recordDataIssues } from '../sync/store.ts'
import { hasDb, isolatedDb } from '../test/db.ts'
import { deliverDataIssues, type Mail, type Mailer } from './mail.ts'

const issue = (n: number): Discrepancy => ({
  key: `machine_client:item-${n}:client-1:client-2`,
  kind: 'machine_client',
  productId: `item-${n}`,
  text: `Изделие ${n}: клиент изделия «А», а его техника «Б» записана на клиента «В»`,
})

describe.skipIf(!hasDb)('letters about data 1С keeps twice and differently (question 24)', () => {
  let db: Db
  let drop: () => Promise<void>
  const outbox: Mail[] = []
  let down = false
  const mailer: Mailer = {
    send: async (mail) => {
      if (down) throw new Error('SMTP недоступен')
      outbox.push(mail)
    },
  }
  const deliver = () => deliverDataIssues(db, mailer, '1c@supplier.ru')
  const open = async () =>
    (
      await db.query<{ key: string }>(
        'select key from data_issues where resolved_at is null order by key',
      )
    ).rows.map((r) => r.key)

  beforeAll(async () => {
    ;({ db, drop } = await isolatedDb())
  })
  afterAll(async () => drop?.())

  it('sends what the rebuild found in one letter, and each disagreement only once', async () => {
    await recordDataIssues(db, [issue(1), issue(2)])
    expect(await deliver()).toBe(2)
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({
      to: '1c@supplier.ru',
      subject: 'РВД Кабинет: обнаружено расхождение данных в 1С (2)',
    })
    expect(outbox[0].text).toContain(`• ${issue(1).text}`)

    await recordDataIssues(db, [issue(1), issue(2)])
    expect(await deliver()).toBe(0)
    expect(outbox).toHaveLength(1)
  })

  it('closes what 1С fixed and writes again when it comes back', async () => {
    await recordDataIssues(db, [issue(2)])
    expect(await open()).toEqual([issue(2).key])
    expect(await deliver()).toBe(0)

    await recordDataIssues(db, [issue(1), issue(2)])
    expect(await deliver()).toBe(1)
    expect(outbox.at(-1)?.text).toContain(issue(1).text)
    expect(outbox.at(-1)?.text).not.toContain(issue(2).text)
  })

  it('keeps a letter the mail server refused for the next run', async () => {
    await recordDataIssues(db, [issue(1), issue(2), issue(3)])
    down = true
    await expect(deliver()).rejects.toThrow('SMTP недоступен')
    const { rows } = await db.query<{ notify_error: string | null }>(
      'select notify_error from data_issues where key = $1',
      [issue(3).key],
    )
    expect(rows[0].notify_error).toBe('SMTP недоступен')
    down = false
    expect(await deliver()).toBe(1)
    expect(outbox.at(-1)?.text).toContain(issue(3).text)
  })
})
