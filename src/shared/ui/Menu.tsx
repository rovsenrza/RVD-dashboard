import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onSelect?: () => void
  danger?: boolean
  /** Renders a hairline above this item. */
  separator?: boolean
}

/**
 * Click-to-open dropdown anchored to its trigger. Closes on outside click and Escape.
 */
export function Menu({
  trigger,
  items,
  align = 'end',
  header,
}: {
  trigger: (open: boolean) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  header?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
      <div onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {trigger(open)}
      </div>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-[calc(100%+6px)] z-40 min-w-56 overflow-hidden rounded-xl bg-sheet p-1.5 shadow-pop',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {header && <div className="px-2.5 pt-1.5 pb-2">{header}</div>}
          {items.map((it) => (
            <div key={it.label}>
              {it.separator && <div className="my-1.5 h-px bg-line" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  it.onSelect?.()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-field',
                  it.danger && 'text-status-replace-ink hover:bg-status-replace-soft',
                )}
              >
                {it.icon && <it.icon size={15} strokeWidth={1.75} className="text-ink-muted" />}
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
