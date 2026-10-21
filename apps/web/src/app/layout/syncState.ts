import { format, isToday, parseISO } from 'date-fns'
import type { SyncStatus } from '@/entities/types'

/** One missed check is a hiccup; the banner speaks up once the data is this old and 1С still silent. */
export const STALE_MS = 30 * 60_000

/** «14:32» today, «05.10 14:32» before. */
export const syncTime = (iso: string) =>
  format(parseISO(iso), isToday(parseISO(iso)) ? 'HH:mm' : 'dd.MM HH:mm')

/** 1С has not answered and the cache is older than a missed check or two. */
export const isUnavailable = (s: SyncStatus | undefined, now = Date.now()) =>
  Boolean(s?.unavailableSince && (!s.syncedAt || now - parseISO(s.syncedAt).getTime() > STALE_MS))
