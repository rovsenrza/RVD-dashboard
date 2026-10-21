import type { RequestStatus } from '@/entities/types'
import { Badge } from '@/shared/ui/Badge'
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE } from './status'

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={REQUEST_STATUS_TONE[status]}>{REQUEST_STATUS_LABEL[status]}</Badge>
}
