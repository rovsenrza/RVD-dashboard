import { addDays, format, formatISO, parseISO, setHours } from 'date-fns'
import type {
  CabinetNotification,
  NotificationKind,
  NotificationPrefs,
  Product,
} from '@/entities/types'
import { plural } from '@/shared/lib/utils'
import { equipment, products, requests, settings, users } from './data'
import { productLifetime } from './productCard'

/** Days of history the scheduler has already run for. */
const WINDOW = 30
/** Older than this the demo treats as read, so the list opens like a working inbox. */
const FRESH = 2

const day = (d: Date) => formatISO(d, { representation: 'date' })
const plus = (iso: string, n: number) => day(addDays(parseISO(iso), n))
const dmy = (iso: string) => format(parseISO(iso), 'dd.MM.yyyy')
const inDays = (n: number) => `через ${n} ${plural(n, 'день', 'дня', 'дней')}`
/** The scheduler runs at six in the morning. */
const morning = (iso: string) => setHours(parseISO(iso), 6).toISOString()

const readIds = new Set<string>()

/** The signed-in user's choice; the BFF keeps one per user. */
export const prefs: Omit<NotificationPrefs, 'address' | 'companyEmail'> = {
  kinds: { overdue: true, planned_replacement: true, warranty_end: true, request_status: true },
  email: true,
}

export const prefsView = (): NotificationPrefs => ({
  ...prefs,
  kinds: { ...prefs.kinds },
  address: users[0].email,
  companyEmail: settings.channels.email,
})

/**
 * The daily scheduler (Д19), replayed over the last 30 days: each morning it
 * checks every hose in service against the rules and the company's lead days,
 * and every request 1С closed. The BFF runs it once a day and stores what it
 * wrote; the mock recomputes, so new lead days in the settings show at once.
 */
export function notificationsFor(branch: string | null, today = new Date()): CabinetNotification[] {
  const t = day(today)
  const from = plus(t, -WINDOW)
  const garage = new Map(equipment.map((e) => [e.id, e.garageNumber]))
  const list: CabinetNotification[] = []

  const hose = (p: Product) =>
    `EHS ${p.serialNumber}${p.equipmentId ? ` · ${garage.get(p.equipmentId)}` : ''}`

  for (const p of products) {
    if (!p.installedAt || p.lifecycle === 'written_off') continue
    if (branch && p.branchId !== branch) continue
    const life = productLifetime(p)!
    const fire = (kind: NotificationKind, due: string, lead: number, message: string) => {
      const on = plus(due, -lead)
      if (on > t || on <= from) return
      list.push({
        id: `${kind}.${p.id}.${lead}`,
        kind,
        lead,
        title: hose(p),
        message,
        dueDate: due,
        productId: p.id,
        requestId: null,
        branchId: p.branchId,
        createdAt: morning(on),
        read: false,
      })
    }
    for (const lead of settings.leadDays) {
      fire(
        'warranty_end',
        life.warrantyUntil,
        lead,
        `Гарантия заканчивается ${dmy(life.warrantyUntil)} — ${inDays(lead)}`,
      )
      fire(
        'planned_replacement',
        life.plannedAt,
        lead,
        `Плановая замена ${dmy(life.plannedAt)} — ${inDays(lead)}. Пора заказать рукав`,
      )
    }
    fire(
      'overdue',
      life.plannedAt,
      0,
      `Срок эксплуатации вышел ${dmy(life.plannedAt)} — рукав пора менять`,
    )
  }

  for (const r of requests) {
    if (r.status !== 'done' && r.status !== 'rejected') continue
    if (branch && r.branchId !== branch) continue
    // 1С closes a request a few days after it is placed; the mock keeps no close date.
    const closed = plus(r.createdAt, 3)
    if (closed > t || closed <= from) continue
    list.push({
      id: `request_status.${r.id}`,
      kind: 'request_status',
      lead: null,
      title: `Заявка ${r.number}`,
      message: r.status === 'done' ? 'Выполнена в 1С' : 'Отклонена в 1С — уточните у менеджера',
      dueDate: null,
      productId: r.productId,
      requestId: r.id,
      branchId: r.branchId,
      createdAt: morning(closed),
      read: false,
    })
  }

  const fresh = plus(t, -FRESH)
  return list
    .filter((n) => prefs.kinds[n.kind])
    .map((n) => ({ ...n, read: readIds.has(n.id) || n.createdAt.slice(0, 10) < fresh }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
}

/** Mark the given notifications read — or every one this user can see now. */
export function markRead(ids: string[] | undefined, branch: string | null) {
  for (const id of ids ?? notificationsFor(branch).map((n) => n.id)) readIds.add(id)
}
