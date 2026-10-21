import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * A sheet: the only container in the system. White, unbordered, soft offset
 * shadow on the warm field. Never nest sheets.
 */
export function Card({
  title,
  action,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn('sheet min-w-0', padded && 'p-5', className)}>
      {(title || action) && (
        <header
          className={cn('mb-4 flex items-center justify-between gap-3', !padded && 'px-5 pt-5')}
        >
          {title && <h2 className="text-sheet-title font-semibold tracking-[-0.01em]">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
