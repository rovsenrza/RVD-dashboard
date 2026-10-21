import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import type { CabinetNotification } from '@/entities/types'
import { useMarkRead, useNotifications } from '@/shared/api/queries'
import { Button, EmptyState } from '@/shared/ui'
import { cn } from '@/shared/lib/utils'
import { notificationTarget, unreadText } from '@/entities/notification'
import { NotificationItem } from '@/features/notifications/NotificationItem'

/** How many the bell shows before «Все уведомления». */
const LATEST = 6

/**
 * The bell: what the daily scheduler wrote (Д19), unread first. A red dot while
 * anything is unread; opening an item reads it and goes to its hose or request.
 */
export function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const query = useNotifications()
  const read = useMarkRead()
  const all = query.data ?? []
  const unread = all.filter((n) => !n.read)
  // Unread first, then the latest read ones to fill the panel.
  const items = [...unread, ...all.filter((n) => n.read)].slice(0, LATEST)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }
  const openItem = (n: CabinetNotification) => {
    if (!n.read) read.mutate([n.id])
    go(notificationTarget(n))
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        icon={Bell}
        aria-label={unread.length ? `Уведомления: ${unreadText(unread.length)}` : 'Уведомления'}
        aria-expanded={open}
        className={cn('relative', open && 'bg-wash')}
        onClick={() => setOpen((o) => !o)}
      >
        {unread.length > 0 && (
          <span className="absolute top-2 right-2 size-2 rounded-full bg-status-replace ring-2 ring-sheet" />
        )}
      </Button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-40 w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-pop shadow-pop">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1.5">
            <span className="text-caption font-medium tracking-wide text-ink-muted uppercase">
              Уведомления{unread.length > 0 && ` · ${unreadText(unread.length)}`}
            </span>
            {unread.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => read.mutate(undefined)}
                className="-mr-2 h-7 px-2 text-label"
              >
                Прочитать все
              </Button>
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState
              inset
              title="Всё спокойно"
              description="Когда подойдёт срок гарантии или замены, уведомление появится здесь."
            />
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto px-1.5">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationItem n={n} compact onOpen={() => openItem(n)} />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line p-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => go('/notifications')}
              className="w-full"
            >
              Все уведомления{all.length > LATEST && ` · ${all.length}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
