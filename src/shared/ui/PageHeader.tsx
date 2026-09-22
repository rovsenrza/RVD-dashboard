import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = 'Назад',
  stickyActions = false,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  backTo?: string
  backLabel?: string
  /**
   * On phones, pin the actions to a bar at the bottom of the screen so the
   * card's main action stays under the thumb while the user scrolls. Layout
   * reserves room for it via [data-sticky-actions].
   */
  stickyActions?: boolean
}) {
  return (
    <div className="mb-5 space-y-2">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-ui text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-title leading-tight font-semibold tracking-[-0.02em] text-balance">
            {title}
          </h1>
          {description && <p className="mt-1 text-ui text-ink-muted">{description}</p>}
        </div>
        {actions && (
          <div
            data-sticky-actions={stickyActions || undefined}
            className={cn(
              'flex items-center gap-2',
              stickyActions &&
                'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-15 max-sm:bg-sheet max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:shadow-[0_-1px_0_var(--color-line)] max-sm:[&>*]:flex-1',
            )}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
