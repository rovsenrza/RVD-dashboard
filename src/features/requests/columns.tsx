import { createColumnHelper } from '@tanstack/react-table'
import type { ServiceRequest } from '@/entities/types'
import { REQUEST_KIND_LABEL, RequestStatusBadge } from '@/entities/request'
import { formatDate } from '@/shared/lib/utils'

const col = createColumnHelper<ServiceRequest>()

export const requestColumns = [
  col.accessor('id', { header: '№' }),
  col.accessor('createdAt', { header: 'Создана', cell: (c) => formatDate(c.getValue()) }),
  col.accessor('kind', { header: 'Тип', cell: (c) => REQUEST_KIND_LABEL[c.getValue()] }),
  col.accessor('productId', { header: 'Изделие', cell: (c) => c.getValue() ?? '—' }),
  col.accessor('quantity', { header: 'Кол-во' }),
  col.accessor('status', {
    header: 'Статус',
    cell: (c) => <RequestStatusBadge status={c.getValue()} />,
  }),
]
