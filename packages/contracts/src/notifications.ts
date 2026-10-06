import type { NotificationKind, NotificationPrefs, RequestStatus } from './types'

/*
 * Notifications (Д19), worded once for the mock and the API. A hose notice fires
 * `lead` days before its date (warranty end, planned replacement) and on the day
 * the service life runs out; a request notice when 1С closes the request.
 */

/** Days back the list reaches: what the daily scheduler wrote over the last month. */
export const NOTIFICATION_WINDOW_DAYS = 30

export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'overdue',
  'planned_replacement',
  'warranty_end',
  'request_status',
]

/** A person who never chose hears about everything, and by e-mail where the company allows it. */
export const DEFAULT_NOTIFICATION_PREFS: Pick<NotificationPrefs, 'kinds' | 'email'> = {
  kinds: { overdue: true, planned_replacement: true, warranty_end: true, request_status: true },
  email: true,
}

const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
const inDays = (n: number) => `через ${n} ${plural(n, 'день', 'дня', 'дней')}`

/** «EHS 48703 · HT08»: the hose and the machine it is on. */
export const hoseNoticeTitle = (serialNumber: string, garageNumber: string | null) =>
  `EHS ${serialNumber}${garageNumber ? ` · ${garageNumber}` : ''}`

/** What a hose notice says, by its kind, date (ISO) and lead. */
export function hoseNoticeText(
  kind: Exclude<NotificationKind, 'request_status'>,
  due: string,
  lead: number,
): string {
  if (kind === 'warranty_end') return `Гарантия заканчивается ${dmy(due)} — ${inDays(lead)}`
  if (kind === 'planned_replacement')
    return `Плановая замена ${dmy(due)} — ${inDays(lead)}. Пора заказать рукав`
  return `Срок эксплуатации вышел ${dmy(due)} — рукав пора менять`
}

export const requestNoticeText = (status: Extract<RequestStatus, 'done' | 'rejected'>) =>
  status === 'done' ? 'Выполнена в 1С' : 'Отклонена в 1С — уточните у менеджера'

/** Server-side check of a preferences patch: known kinds, yes or no. */
export function notificationPrefsProblem(
  patch: Partial<Pick<NotificationPrefs, 'kinds' | 'email'>>,
): string | null {
  if (patch.email !== undefined && typeof patch.email !== 'boolean')
    return 'Письма: укажите да или нет'
  const kinds = patch.kinds
  if (kinds !== undefined) {
    if (typeof kinds !== 'object' || kinds === null) return 'Уведомления указаны неверно'
    for (const [kind, on] of Object.entries(kinds))
      if (!NOTIFICATION_KINDS.includes(kind as NotificationKind) || typeof on !== 'boolean')
        return 'Уведомления указаны неверно'
  }
  return null
}
