import type { ProductStatus } from '@/entities/types'
import { Badge } from '@/shared/ui/Badge'
import { STATUS_LABEL, STATUS_TONE } from './status'

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Badge>
  )
}
