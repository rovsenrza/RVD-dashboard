import { createColumnHelper } from '@tanstack/react-table'
import type { Product } from '@/entities/types'
import { ProductStatusBadge } from '@/entities/product'
import { formatDate } from '@/shared/lib/utils'
import { valueOr } from '@/shared/ui'

const col = createColumnHelper<Product>()

export const productColumns = [
  col.accessor('serialNumber', {
    header: 'EHS №',
    cell: (c) => <span className="font-medium text-brand-deep">{c.getValue()}</span>,
  }),
  col.accessor('clientNumber', { header: 'Внутр. №', cell: (c) => valueOr(c.getValue()) }),
  col.accessor('oemNumber', { header: 'OEM', cell: (c) => valueOr(c.getValue()) }),
  col.accessor('type', { header: 'Тип' }),
  col.accessor('manufacturer', {
    header: 'Производитель',
    cell: (c) => <span className="text-ink-secondary">{c.getValue()}</span>,
  }),
  col.accessor('shippedAt', { header: 'Отгрузка', cell: (c) => valueOr(formatDate(c.getValue())) }),
  col.accessor('installedAt', {
    header: 'Установка',
    cell: (c) => valueOr(formatDate(c.getValue())),
  }),
  col.accessor('status', {
    header: 'Статус',
    cell: (c) => <ProductStatusBadge status={c.getValue()} />,
  }),
  col.accessor('installPlace', { header: 'Место установки', cell: (c) => valueOr(c.getValue()) }),
]
