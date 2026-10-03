import { createColumnHelper } from '@tanstack/react-table'
import type { ServiceRequest } from '@/entities/types'
import { REQUEST_KIND_LABEL, RequestStatusBadge } from '@/entities/request'
import { isSpreadsheet } from '@/entities/request/rules'
import { formatDate } from '@/shared/lib/utils'
import { valueOr } from '@/shared/ui'
import { AttachmentsButton } from '@/features/attachments/AttachmentStrip'

const col = createColumnHelper<ServiceRequest>()

export const requestColumns = [
  col.accessor('number', {
    header: '№',
    cell: (c) => (
      <span className="inline-flex items-center gap-1">
        <span className="font-medium text-brand-deep">{c.getValue()}</span>
        <AttachmentsButton files={c.row.original.attachments} />
      </span>
    ),
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
      header: 'Каталожный № (OEM)',
      // A request sent with only an Excel file has no lines: say where they are.
      cell: (c) =>
        c.getValue() ||
        (c.row.original.attachments.some((f) => isSpreadsheet(f.fileName)) ? (
          <span className="text-ink-muted">в файле Excel</span>
        ) : (
          valueOr(null)
        )),
    },
  ),
  col.accessor('quantity', { header: 'Кол-во' }),
  col.accessor('status', {
    header: 'Статус',
    meta: { mobile: 'aside' },
    cell: (c) => <RequestStatusBadge status={c.getValue()} />,
  }),
  col.accessor('shipmentStatus', {
    header: 'Отгрузка',
    cell: (c) => (c.getValue() === 'shipped' ? 'Отгружен' : 'Не отгружен'),
  }),
]
