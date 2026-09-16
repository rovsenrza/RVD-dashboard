import type { ProductStatus } from '@/entities/types'
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from './status'

/** Stacked horizontal bar of hose statuses for one piece of equipment. */
export function ProductStatusBar({ breakdown }: { breakdown: Record<ProductStatus, number> }) {
  const total = STATUS_ORDER.reduce((s, k) => s + breakdown[k], 0) || 1
  return (
    <div className="flex h-4 w-full min-w-40 overflow-hidden rounded bg-line" role="img">
      {STATUS_ORDER.map((k) =>
        breakdown[k] ? (
          <div
            key={k}
            title={`${STATUS_LABEL[k]}: ${breakdown[k]}`}
            className="flex items-center justify-center text-[10px] text-white"
            style={{ width: `${(breakdown[k] / total) * 100}%`, background: STATUS_COLOR[k] }}
          >
            {breakdown[k]}
          </div>
        ) : null,
      )}
    </div>
  )
}
