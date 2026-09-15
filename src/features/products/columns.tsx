import { createColumnHelper } from '@tanstack/react-table'
import type { Product } from '@/entities/types'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { formatDate } from '@/shared/lib/utils'

const col = createColumnHelper<Product>()

export const productColumns = [
  col.accessor('serialNumber', {
    header: 'EHS №',
    cell: (c) => <span className="font-medium text-brand-dark">{c.getValue()}</span>,
  }),
  col.accessor('clientNumber', { header: 'Внутр. №', cell: (c) => c.getValue() ?? '—' }),
  col.accessor('oemNumber', { header: 'OEM', cell: (c) => c.getValue() ?? '—' }),
  col.accessor('type', { header: 'Тип' }),
  col.accessor('manufacturer', { header: 'Производитель' }),
  col.accessor('shippedAt', { header: 'Отгрузка', cell: (c) => formatDate(c.getValue()) }),
  col.accessor('installedAt', { header: 'Установка', cell: (c) => formatDate(c.getValue()) }),
  col.accessor('status', { header: 'Статус', cell: (c) => <StatusBadge status={c.getValue()} /> }),
  col.accessor('installPlace', { header: 'Место установки', cell: (c) => c.getValue() ?? '—' }),
]
