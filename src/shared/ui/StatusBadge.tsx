import type { ProductStatus } from '@/entities/types'
import { cn, STATUS_CLASS, STATUS_LABEL } from '@/shared/lib/utils'

export function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
