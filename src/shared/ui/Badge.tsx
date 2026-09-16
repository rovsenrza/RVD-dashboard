import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const badge = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-line text-ink-muted',
        ok: 'bg-status-ok/15 text-status-ok',
        warn: 'bg-status-warn/15 text-status-warn',
        replace: 'bg-status-replace/15 text-status-replace',
        none: 'bg-status-none/15 text-status-none',
        brand: 'bg-brand/15 text-brand-dark',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps extends VariantProps<typeof badge> {
  children: ReactNode
  className?: string
  /** Leading colour dot. */
  dot?: boolean
}

export function Badge({ tone, dot, className, children }: BadgeProps) {
  return (
    <span className={cn(badge({ tone }), className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
