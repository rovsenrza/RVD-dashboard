import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export interface TabItem<K extends string> {
  key: K
  label: ReactNode
  count?: number
}

/** Underline tabs in the reference's grammar: amber rule under the active tab. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<K>[]
  value: K
  onChange: (k: K) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex gap-6 border-b border-line', className)}>
      {items.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 pt-1 pb-2.5 text-sm whitespace-nowrap transition-colors duration-150',
              active
                ? 'border-brand font-medium text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-micro tabular',
                  active ? 'bg-brand-soft text-brand-deep' : 'bg-field text-ink-muted',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
