import { createColumnHelper } from '@tanstack/react-table'
import type { ServiceRequest } from '@/entities/types'
import { REQUEST_KIND_LABEL, RequestStatusBadge } from '@/entities/request'
import { formatDate } from '@/shared/lib/utils'
import { valueOr } from '@/shared/ui'

const col = createColumnHelper<ServiceRequest>()

export const requestColumns = [
  col.accessor('number', {
    header: '№',
    cell: (c) => <span className="font-medium text-brand-deep">{c.getValue()}</span>,
  }),
  col.accessor('createdAt', { header: 'Создана', cell: (c) => valueOr(formatDate(c.getValue())) }),
  col.accessor('kind', { header: 'Тип', cell: (c) => REQUEST_KIND_LABEL[c.getValue()] }),
  col.accessor(
    (r) =>
      r.positions
        .map((p) => p.catalogNumber)
        .filter(Boolean)
        .join(', '),
    {
      id: 'catalog',
      header: 'Каталожный №',
      cell: (c) => valueOr(c.getValue() || null),
    },
  ),
  col.accessor('quantity', { header: 'Кол-во' }),
  col.accessor('status', {
    header: 'Статус',
    cell: (c) => <RequestStatusBadge status={c.getValue()} />,
  }),
  col.accessor('shipmentStatus', {
    header: 'Отгрузка',
    cell: (c) => (c.getValue() === 'shipped' ? 'Отгружен' : 'Не отгружен'),
  }),
]
