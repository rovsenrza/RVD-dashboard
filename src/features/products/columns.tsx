import { createColumnHelper } from '@tanstack/react-table'
import type { Equipment, Product } from '@/entities/types'
import { ProductStatusBadge, serviceDates } from '@/entities/product'
import { formatDate } from '@/shared/lib/utils'
import { valueOr } from '@/shared/ui'

const col = createColumnHelper<Product>()

/** «Komatsu PC200»: the machine a hose is on, by its make and model; the model waits for 1С. */
export const machineName = (e: Equipment | undefined) =>
  e ? [e.brand, e.model].filter(Boolean).join(' ') || null : null

export const productColumns = (machines: ReadonlyMap<string, Equipment>) => [
  col.accessor('serialNumber', {
    header: 'Серийный №',
    cell: (c) => <span className="font-medium text-brand-deep">{c.getValue()}</span>,
  }),
  col.accessor('clientNumber', { header: 'Ваш №', cell: (c) => valueOr(c.getValue()) }),
  col.accessor('catalogNumber', {
    header: 'Каталожный № (OEM)',
    cell: (c) => valueOr(c.getValue()),
  }),
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
  // Which machine it is on, so a replacement reads against the machine (customer, 2026-10-11).
  // The machines are known only to the browser here, so this column does not sort.
  col.accessor((p) => machineName(p.equipmentId ? machines.get(p.equipmentId) : undefined), {
    id: 'machine',
    header: 'Марка / модель',
    enableSorting: false,
    meta: { mobile: 'hide' },
    cell: (c) => {
      const e = c.row.original.equipmentId ? machines.get(c.row.original.equipmentId) : undefined
      if (!e) return valueOr(null)
      return (
        <span>
          {valueOr(c.getValue())}
          <span className="block text-label text-ink-muted">{e.garageNumber}</span>
        </span>
      )
    },
  }),
  // The start of «Пора менять»; the server sorts by the same rule under this id.
  col.accessor((p) => serviceDates(p)?.plannedAt ?? null, {
    id: 'plannedAt',
    header: 'Плановая замена',
    meta: { mobile: 'hide' },
    cell: (c) => valueOr(formatDate(c.getValue())),
  }),
  col.accessor('installPlace', { header: 'Место установки', cell: (c) => valueOr(c.getValue()) }),
]
