import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from './Button'

/**
 * Modal sheet: centred on ≥sm, a full-width bottom sheet on phones with the
 * footer actions sharing the width and clearing the home indicator. Closes on
 * Escape and on overlay click; locks body scroll while open so long tables
 * underneath do not drift.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-2xl bg-pop shadow-pop sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex items-start gap-4 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-sheet-title font-semibold tracking-[-0.01em]">{title}</h2>
            {description && <p className="mt-1 text-ui text-ink-muted">{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            icon={X}
            onClick={onClose}
            aria-label="Закрыть"
            className="-mt-1 -mr-1.5"
          />
        </div>
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-5 pt-4',
            footer ? 'pb-4' : 'pb-[max(1rem,env(safe-area-inset-bottom))]',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="flex justify-end gap-2 bg-field px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] max-sm:[&>*]:flex-1">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
