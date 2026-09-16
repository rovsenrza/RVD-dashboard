import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap leading-5',
  {
    variants: {
      tone: {
        neutral: 'bg-status-none-soft text-ink-secondary',
        ok: 'bg-status-ok-soft text-status-ok-ink',
        warn: 'bg-status-warn-soft text-status-warn-ink',
        replace: 'bg-status-replace-soft text-status-replace-ink',
        none: 'bg-status-none-soft text-status-none-ink',
        brand: 'bg-brand-soft text-brand-deep',
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
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  )
}
