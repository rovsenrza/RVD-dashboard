import type { ProductStatus } from '@/entities/types'
import { cn } from '@/shared/lib/utils'
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER, STATUS_TEXT_CLASS } from './status'

/**
 * Stacked status bar for one piece of equipment, with counts beside it.
 * Counts live outside the segments so every colour stays the semantic one
 * and every number stays AA.
 */
export function ProductStatusBar({ breakdown }: { breakdown: Record<ProductStatus, number> }) {
  const total = STATUS_ORDER.reduce((s, k) => s + breakdown[k], 0) || 1
  const present = STATUS_ORDER.filter((k) => breakdown[k] > 0)
  return (
    <div className="flex min-w-56 items-center gap-3">
      <div
        className="flex h-2.5 flex-1 gap-px overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={present.map((k) => `${STATUS_LABEL[k]}: ${breakdown[k]}`).join(', ')}
      >
        {present.map((k) => (
          <div
            key={k}
            title={`${STATUS_LABEL[k]}: ${breakdown[k]}`}
            style={{ width: `${(breakdown[k] / total) * 100}%`, background: STATUS_COLOR[k] }}
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2.5 text-[12.5px] font-medium tabular">
        {present.map((k) => (
          <span
            key={k}
            className={cn('inline-flex items-center gap-1', STATUS_TEXT_CLASS[k])}
            title={STATUS_LABEL[k]}
          >
            <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />
            {breakdown[k]}
          </span>
        ))}
      </div>
    </div>
  )
}
