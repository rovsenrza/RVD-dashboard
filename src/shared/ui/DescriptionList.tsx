import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { valueOr } from './EmptyValue'

/**
 * Label/value pairs in two aligned columns: muted terms, tabular values,
 * missing values rendered as EmptyValue. `termWidth` is the minimum term
 * column; it grows for a longer label rather than wrapping it.
 */
export function DescriptionList({
  items,
  termWidth = 140,
  className,
}: {
  items: [string, ReactNode][]
  termWidth?: number
  className?: string
}) {
  return (
    <dl
      style={{ '--term': `${termWidth}px` } as CSSProperties}
      className={cn(
        'grid grid-cols-[minmax(var(--term),auto)_1fr] gap-x-6 gap-y-1.5 text-ui',
        className,
      )}
    >
      {items.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-muted">{term}</dt>
          <dd className="min-w-0 tabular">{valueOr(value)}</dd>
        </div>
      ))}
    </dl>
  )
}
