import { createColumnHelper } from '@tanstack/react-table'
import type { Product } from '@/entities/types'
import { ProductStatusBadge } from '@/entities/product'
import { formatDate } from '@/shared/lib/utils'
import { valueOr } from '@/shared/ui'

const col = createColumnHelper<Product>()

export const productColumns = [
  col.accessor('serialNumber', {
    header: 'Серийный №',
    cell: (c) => <span className="font-medium text-brand-deep">{c.getValue()}</span>,
  }),
  col.accessor('clientNumber', { header: 'Ваш №', cell: (c) => valueOr(c.getValue()) }),
  col.accessor('catalogNumber', { header: 'Каталожный №', cell: (c) => valueOr(c.getValue()) }),
  col.accessor('type', { header: 'Тип' }),
  col.accessor('manufacturer', {
    header: 'Производитель',
    meta: { mobile: 'hide' },
    cell: (c) => <span className="text-ink-secondary">{c.getValue()}</span>,
  }),
  col.accessor('shippedAt', {
    header: 'Отгрузка',
    meta: { mobile: 'hide' },
    cell: (c) => valueOr(formatDate(c.getValue())),
  }),
  // Until an installation is recorded the date defaults to the shipment date;
  // the fallback is muted so it does not read as a recorded fact.
  col.accessor('installedAt', {
    header: 'Установка',
    cell: (c) => {
      const { installedAt, shippedAt } = c.row.original
      if (installedAt) return formatDate(installedAt)
      return shippedAt ? (
        <span
          className="text-ink-muted"
          title="Дата установки не указана — по умолчанию дата отгрузки"
        >
          {formatDate(shippedAt)}
        </span>
      ) : (
        valueOr(null)
      )
    },
  }),
  col.accessor('status', {
    header: 'Статус',
    meta: { mobile: 'aside' },
    cell: (c) => <ProductStatusBadge status={c.getValue()} />,
  }),
  col.accessor('installPlace', { header: 'Место установки', cell: (c) => valueOr(c.getValue()) }),
]
