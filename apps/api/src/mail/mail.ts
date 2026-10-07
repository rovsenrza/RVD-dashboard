import nodemailer from 'nodemailer'
import {
  DEFAULT_SETTINGS,
  SUPPORT_TOPIC_LABEL,
  type CabinetNotification,
  type CabinetSettings,
  type SupportTopic,
} from '@rvd/contracts'
import type { Db } from '../db/pool.ts'
import { listNotifications, notificationPrefs } from '../notifications/query.ts'

/*
 * Mail (Д19, «Связаться со специалистом»): nothing here runs until the
 * customer's SMTP is configured (question 7); without it nothing is sent and
 * nothing is marked as sent.
 */

export interface Mail {
  to: string
  subject: string
  text: string
}

export interface Mailer {
  send: (mail: Mail) => Promise<void>
}

/** SMTP from a URL such as `smtps://user:password@mail.example.ru:465`. */
export function smtpMailer(url: string, from: string): Mailer {
  const transport = nodemailer.createTransport(url)
  return {
    send: async (mail) => {
      await transport.sendMail({ from, ...mail })
    },
  }
}

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

interface MessageRow {
  id: string
  author_name: string
  author_email: string
  company: string | null
  topic: SupportTopic
  serial: string | null
  shown_date: string | null
  installed_at: string | null
  text: string
  created_at: Date
}

/**
 * Passes the messages to the specialist that wait (question 15 decides the
 * address): one letter each, the customer as Reply-To in the text; a failure
 * is kept on the message and tried again on the next run.
 */
export async function deliverSupport(
  db: Db,
  mailer: Mailer,
  to: string,
): Promise<{ sent: number; failed: number }> {
  const { rows } = await db.query<MessageRow>(
    `select m.id, m.author_name, m.author_email, c.name as company, m.topic, p.serial_number as serial,
       to_char(coalesce(p.installed_at, p.shipped_at), 'YYYY-MM-DD') as shown_date,
       to_char(m.installed_at, 'YYYY-MM-DD') as installed_at, m.text, m.created_at
     from support_messages m
     left join companies c on c.id = m.company_id
     left join products p on p.id = m.product_id
     where m.delivered_at is null
     order by m.created_at limit 50`,
  )
  let sent = 0
  let failed = 0
  for (const m of rows) {
    const lines = [
      `Тема: ${SUPPORT_TOPIC_LABEL[m.topic]}`,
      m.serial && `Изделие: EHS ${m.serial}`,
      m.installed_at &&
        `Верная дата установки: ${dmy(m.installed_at)}${m.shown_date ? ` (в кабинете: ${dmy(m.shown_date)})` : ''}`,
      `От: ${m.author_name} <${m.author_email}>${m.company ? `, ${m.company}` : ''}`,
      m.text && `\n${m.text}`,
    ].filter(Boolean)
    try {
      await mailer.send({
        to,
        subject: `РВД Кабинет: ${SUPPORT_TOPIC_LABEL[m.topic]}${m.serial ? `, EHS ${m.serial}` : ''}`,
        text: lines.join('\n'),
      })
      await db.query(
        'update support_messages set delivered_at = now(), delivery_error = null where id = $1',
        [m.id],
      )
      sent++
    } catch (error) {
      await db.query('update support_messages set delivery_error = $2 where id = $1', [
        m.id,
        error instanceof Error ? error.message : String(error),
      ])
      failed++
    }
  }
  return { sent, failed }
}

/** The day a notice fired: `lead` days before its date, or the day 1С closed the request. */
const firedOn = (n: CabinetNotification) =>
  n.dueDate && n.lead !== null
    ? new Date(Date.parse(`${n.dueDate}T00:00:00Z`) - n.lead * 86_400_000)
        .toISOString()
        .slice(0, 10)
    : new Date(n.createdAt).toLocaleDateString('sv-SE')

interface Reader {
  id: string
  name: string
  email: string
  client: string
  settings: Partial<CabinetSettings>
}

/**
 * The day's digest (Д19): to each active person who asked for letters, in a
 * company that allows them, what fired today and is still unread — once a day,
 * however often the job runs.
 */
export async function sendDigests(
  db: Db,
  mailer: Mailer,
  today: string,
  cabinetUrl?: string,
): Promise<number> {
  const { rows: readers } = await db.query<Reader>(
    `select u.id, u.name, u.email, c.onec_client_key as client, c.settings
     from users u join companies c on c.id = u.company_id
     where u.active and not exists (
       select 1 from notification_mail m where m.user_id = u.id and m.day = $1::date)`,
    [today],
  )
  let sent = 0
  for (const r of readers) {
    const settings = { ...DEFAULT_SETTINGS, ...r.settings }
    const prefs = await notificationPrefs(db, r.id)
    if (!settings.channels.email || !prefs.email) continue
    const fresh = (
      await listNotifications(db, today, {
        userId: r.id,
        client: r.client,
        leadDays: settings.leadDays,
        inspectionDays: settings.inspectionDays,
        kinds: prefs.kinds,
      })
    ).filter((n) => !n.read && firedOn(n) === today)
    if (!fresh.length) continue
    await mailer.send({
      to: r.email,
      subject: `РВД Кабинет: ${fresh.length === 1 ? fresh[0].title : `уведомлений — ${fresh.length}`}`,
      text: [
        `${r.name}, на ${dmy(today)}:`,
        '',
        ...fresh.map((n) => `• ${n.title}: ${n.message}`),
        ...(cabinetUrl
          ? ['', `Все уведомления: ${cabinetUrl.replace(/\/+$/, '')}/notifications`]
          : []),
        '',
        'Письма можно отключить в кабинете: Уведомления → Настройки.',
      ].join('\n'),
    })
    await db.query('insert into notification_mail (user_id, day, notices) values ($1, $2, $3)', [
      r.id,
      today,
      fresh.length,
    ])
    sent++
  }
  return sent
}

export interface MailJobOptions {
  intervalMs: number
  /** Where messages to the specialist go (question 15); unset — they wait */
  supportTo?: string
  /** Local hour from which the day's digest goes out */
  digestHour: number
  cabinetUrl?: string
  onError?: (error: unknown) => void
}

/** The mail worker: waiting messages every run, the digest once a day from `digestHour`. */
export function startMail(db: Db, mailer: Mailer, options: MailJobOptions) {
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      if (options.supportTo) await deliverSupport(db, mailer, options.supportTo)
      const now = new Date()
      if (now.getHours() >= options.digestHour)
        await sendDigests(db, mailer, now.toLocaleDateString('sv-SE'), options.cabinetUrl)
    } catch (error) {
      options.onError?.(error)
    } finally {
      busy = false
    }
  }
  const timer = setInterval(() => void tick(), options.intervalMs)
  void tick()
  return { stop: () => clearInterval(timer) }
}
