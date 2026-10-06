import type { CabinetNotification, NotificationKind } from '@/entities/types'
import { plural } from '@/shared/lib/utils'

/** Where a notification leads: its hose, or the request list. */
export const notificationTarget = (n: CabinetNotification) =>
  n.kind === 'request_status' ? '/requests' : `/products/${n.productId}`

/** «1 новое», «3 новых». */
export const unreadText = (n: number) => `${n} ${plural(n, 'новое', 'новых', 'новых')}`

/** The rules and their wording live in @rvd/contracts, shared with the API. */
export {
  DEFAULT_NOTIFICATION_PREFS,
  hoseNoticeText,
  hoseNoticeTitle,
  NOTIFICATION_KINDS,
  NOTIFICATION_WINDOW_DAYS,
  requestNoticeText,
} from '@rvd/contracts'

/** How the preferences and filters name each rule. */
export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  overdue: 'Превышен срок эксплуатации',
  planned_replacement: 'Плановая замена',
  warranty_end: 'Окончание гарантии',
  request_status: 'Заявки: выполнены или отклонены',
}

export const NOTIFICATION_KIND_HINT: Record<NotificationKind, string> = {
  overdue: 'В день, когда рукав выработал срок',
  planned_replacement: 'За сколько дней — задаёт администратор',
  warranty_end: 'За сколько дней — задаёт администратор',
  request_status: 'Когда 1С закрывает заявку',
}
