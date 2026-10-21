import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/utils'

const OPEN_DELAY = 350
const GAP = 6
const EDGE = 8

/**
 * A short hint on the pop surface, shown after a hover delay or at once on
 * keyboard focus; Escape dismisses it. The child keeps its own semantics and
 * gains aria-describedby while the hint is visible. Not for anything the user
 * must read to finish a task — that belongs on the page.
 */
export function Tooltip({
  content,
  side = 'top',
  className,
  style,
  children,
}: {
  content: ReactNode
  side?: 'top' | 'bottom'
  /** Layout for the wrapper around the child, e.g. a flex share inside a bar. */
  className?: string
  style?: CSSProperties
  children: ReactElement<{ 'aria-describedby'?: string }>
}) {
  const id = useId()
  const anchor = useRef<HTMLSpanElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const show = (delay: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setOpen(false)
    setPos(null)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
    }
  }, [open])

  // Measure after the hint renders, then place it: preferred side, flipped when
  // there is no room, clamped to the viewport horizontally.
  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return
    const a = anchor.current.getBoundingClientRect()
    const t = tip.current.getBoundingClientRect()
    const above = a.top - GAP - t.height
    const below = a.bottom + GAP
    const top =
      side === 'top'
        ? above >= EDGE
          ? above
          : below
        : below + t.height <= window.innerHeight - EDGE
          ? below
          : above
    const centred = a.left + a.width / 2 - t.width / 2
    const left = Math.min(Math.max(centred, EDGE), window.innerWidth - t.width - EDGE)
    setPos({ top, left })
  }, [open, side, content])

  return (
    <>
      <span
        ref={anchor}
        className={cn('inline-flex', className)}
        style={style}
        onPointerEnter={(e) => e.pointerType === 'mouse' && show(OPEN_DELAY)}
        onPointerLeave={hide}
        onFocus={(e) => e.target.matches(':focus-visible') && show(0)}
        onBlur={hide}
      >
        {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      </span>
      {open &&
        createPortal(
          <div
            ref={tip}
            id={id}
            role="tooltip"
            style={pos ?? { top: 0, left: 0, visibility: 'hidden' }}
            className="pointer-events-none fixed z-50 max-w-64 rounded-md bg-pop px-2 py-1 text-caption text-ink shadow-pop"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
