import { createColumnHelper } from '@tanstack/react-table'
import type { Replacement } from '@/entities/types'
import { formatUsage } from '@/entities/replacement'
import { formatDate } from '@/shared/lib/utils'
import { valueOr } from '@/shared/ui'

const col = createColumnHelper<Replacement>()

export const replacementColumns = [
  col.accessor('date', {
    header: 'Дата',
    meta: { mobile: 'aside' },
    cell: (c) => valueOr(formatDate(c.getValue())),
  }),
  col.accessor('oldSerialNumber', {
    header: 'Заменено',
    meta: { mobile: 'title' },
    cell: (c) => <span className="font-medium text-brand-deep">{c.getValue()}</span>,
  }),
  col.accessor('newSerialNumber', { header: 'Установлено', cell: (c) => valueOr(c.getValue()) }),
  col.accessor('garageNumber', { header: 'Техника' }),
  col.accessor('reason', { header: 'Причина' }),
  col.accessor((r) => r.operatingHours, {
    id: 'usage',
    header: 'Наработка',
    cell: (c) => valueOr(formatUsage(c.row.original)),
  }),
  col.accessor('performedBy', { header: 'Кто выполнил', meta: { mobile: 'hide' } }),
]
