import type { ProductStatus } from '@/entities/types'
import { Tooltip } from '@/shared/ui'
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from './status'

/** Stacked horizontal bar of hose statuses for one piece of equipment, with counts inside each segment. */
export function ProductStatusBar({ breakdown }: { breakdown: Record<ProductStatus, number> }) {
  const total = STATUS_ORDER.reduce((s, k) => s + breakdown[k], 0) || 1
  return (
    <div
      className="flex h-4 w-full min-w-40 overflow-hidden rounded bg-line"
      role="img"
      aria-label={STATUS_ORDER.filter((k) => breakdown[k] > 0)
        .map((k) => `${STATUS_LABEL[k]}: ${breakdown[k]}`)
        .join(', ')}
    >
      {STATUS_ORDER.map((k) =>
        breakdown[k] ? (
          <Tooltip
            key={k}
            content={`${STATUS_LABEL[k]}: ${breakdown[k]}`}
            className="flex"
            style={{ width: `${(breakdown[k] / total) * 100}%` }}
          >
            <div
              className="flex flex-1 items-center justify-center text-micro text-on-status"
              style={{ background: STATUS_COLOR[k] }}
            >
              {breakdown[k]}
            </div>
          </Tooltip>
        ) : null,
      )}
    </div>
  )
}
