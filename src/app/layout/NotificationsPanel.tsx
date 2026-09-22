import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, ClipboardCheck, Clock, type LucideIcon } from 'lucide-react'
import { formatISO, subDays } from 'date-fns'
import { REQUEST_STATUS_LABEL } from '@/entities/request'
import { useDashboard, useRequests } from '@/shared/api/queries'
import { Button, EmptyState } from '@/shared/ui'
import { cn, formatDate } from '@/shared/lib/utils'

interface Notification {
  id: string
  icon: LucideIcon
  tone: 'replace' | 'warn' | 'none'
  title: string
  subtitle: string
  to: string
}

/**
 * Derived on the client from data already loaded. Д19 moves this behind
 * rules and a scheduler on the API; the panel keeps the same shape.
 */
function useNotifications(): Notification[] {
  const dashboard = useDashboard()
  const requests = useRequests()

  return useMemo(() => {
    const list: Notification[] = []
    const d = dashboard.data
    if (d?.needsReplacement) {
      list.push({
        id: 'replace',
        icon: AlertTriangle,
        tone: 'replace',
        title: `Требуют замены: ${d.needsReplacement}`,
        subtitle: 'Срок эксплуатации вышел',
        to: '/products?status=replace',
      })
    }
    if (d?.expiringSoon) {
      list.push({
        id: 'warn',
        icon: Clock,
        tone: 'warn',
        title: `Срок истекает: ${d.expiringSoon}`,
        subtitle: 'Осталось меньше 20 % ресурса',
        to: '/products?status=warn',
      })
    }
    for (const u of d?.upcoming.slice(0, 3) ?? []) {
      list.push({
        id: `up-${u.productId}`,
        icon: Clock,
        tone: 'none',
        title: `EHS ${u.serialNumber} · ${u.equipment}`,
        subtitle: `Плановая замена ${formatDate(u.dueDate)}`,
        to: `/products/${u.productId}`,
      })
    }
    const weekAgo = formatISO(subDays(new Date(), 7), { representation: 'date' })
    for (const r of requests.data ?? []) {
      if ((r.status === 'done' || r.status === 'rejected') && r.createdAt >= weekAgo) {
        list.push({
          id: `req-${r.id}`,
          icon: ClipboardCheck,
          tone: 'none',
          title: `Заявка ${r.number}: ${REQUEST_STATUS_LABEL[r.status].toLowerCase()}`,
          subtitle: formatDate(r.createdAt) ?? '',
          to: '/requests',
        })
      }
    }
    return list
  }, [dashboard.data, requests.data])
}

const TONE_CLASS = {
  replace: 'text-status-replace-ink',
  warn: 'text-status-warn-ink',
  none: 'text-ink-muted',
} as const

export function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const items = useNotifications()
  const urgent = items.some((n) => n.tone !== 'none')

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

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        icon={Bell}
        aria-label="Уведомления"
        aria-expanded={open}
        className={cn('relative', open && 'bg-wash')}
        onClick={() => setOpen((o) => !o)}
      >
        {urgent && (
          <span className="absolute top-2 right-2 size-2 rounded-full bg-status-replace ring-2 ring-sheet" />
        )}
      </Button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-40 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-pop shadow-pop">
          <div className="px-4 pt-3 pb-2 text-[12px] font-medium tracking-wide text-ink-muted uppercase">
            Уведомления
          </div>
          {items.length === 0 ? (
            <EmptyState inset title="Всё спокойно" description="Нет изделий, требующих внимания." />
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto p-1.5 pt-0">
              {items.map((n) => (
                <li key={n.id}>
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => {
                      setOpen(false)
                      navigate(n.to)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(n.to)}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-wash"
                  >
                    <n.icon
                      size={16}
                      strokeWidth={1.75}
                      className={cn('mt-0.5 shrink-0', TONE_CLASS[n.tone])}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium">{n.title}</span>
                      <span className="block text-[12.5px] text-ink-muted">{n.subtitle}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
