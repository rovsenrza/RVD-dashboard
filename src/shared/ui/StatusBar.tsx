import type { ProductStatus } from '@/entities/types'
import { cn, STATUS_BAR_CLASS, STATUS_LABEL } from '@/shared/lib/utils'

const ORDER: ProductStatus[] = ['ok', 'warn', 'replace', 'no_warranty']

/** Stacked horizontal bar of hose statuses for one piece of equipment. */
export function StatusBar({ breakdown }: { breakdown: Record<ProductStatus, number> }) {
  const total = ORDER.reduce((s, k) => s + breakdown[k], 0) || 1
  return (
    <div className="flex h-4 w-full min-w-40 overflow-hidden rounded bg-line" role="img">
      {ORDER.map((k) =>
        breakdown[k] ? (
          <div
            key={k}
            title={`${STATUS_LABEL[k]}: ${breakdown[k]}`}
            className={cn(
              'flex items-center justify-center text-[10px] text-white',
              STATUS_BAR_CLASS[k],
            )}
            style={{ width: `${(breakdown[k] / total) * 100}%` }}
          >
            {breakdown[k]}
          </div>
        ) : null,
      )}
    </div>
  )
}
