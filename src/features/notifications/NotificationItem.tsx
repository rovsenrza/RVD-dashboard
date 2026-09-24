import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import type { CabinetNotification, NotificationKind } from '@/entities/types'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui'

/** Each rule keeps one icon and one status tone everywhere it appears (tile ground + icon ink). */
const KIND: Record<NotificationKind, { icon: LucideIcon; tile: string }> = {
  overdue: { icon: AlertTriangle, tile: 'bg-status-replace-soft text-status-replace-ink' },
  planned_replacement: { icon: CalendarClock, tile: 'bg-status-warn-soft text-status-warn-ink' },
  warranty_end: { icon: ShieldAlert, tile: 'bg-status-none-soft text-status-none-ink' },
  request_status: { icon: ClipboardCheck, tile: 'bg-field text-ink-secondary' },
}

/**
 * One notification: the rule's tile, what it is about, what happened, when.
 * Unread ones are set heavier and carry an amber dot.
 */
export function NotificationItem({
  n,
  onOpen,
  compact = false,
}: {
  n: CabinetNotification
  onOpen: () => void
  /** In the bell panel: time only for today, a date otherwise, tighter padding */
  compact?: boolean
}) {
  const { icon: Icon, tile } = KIND[n.kind]
  const at = parseISO(n.createdAt)
  return (
    <Button
      variant="ghost"
      size="auto"
      onClick={onOpen}
      className={cn(
        'h-auto w-full items-start gap-3 whitespace-normal',
        compact ? 'px-2.5 py-2' : 'px-3 py-3',
      )}
    >
      <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', tile)}>
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn('truncate text-ui text-ink', !n.read && 'font-semibold')}>
            {n.title}
          </span>
          <span className="shrink-0 text-label text-ink-muted tabular">
            {compact && !isToday(at) ? format(at, 'dd.MM') : format(at, 'HH:mm')}
          </span>
        </span>
        <span className="mt-0.5 block text-label text-ink-secondary">{n.message}</span>
      </span>
      <span
        className={cn('mt-2 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')}
        aria-label={n.read ? undefined : 'Не прочитано'}
      />
    </Button>
  )
}
