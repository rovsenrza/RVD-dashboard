import { createColumnHelper } from '@tanstack/react-table'
import type { Equipment } from '@/entities/types'
import { ProductStatusBar } from '@/entities/product'
import { formatDate } from '@/shared/lib/utils'
import { valueOr } from '@/shared/ui'

const col = createColumnHelper<Equipment>()

export const equipmentColumns = [
  col.accessor('garageNumber', {
    header: 'Гаражный №',
    cell: (c) => <span className="font-medium text-brand-deep">{c.getValue()}</span>,
  }),
  col.accessor('factoryNumber', {
    header: 'Заводской №',
    meta: { mobile: 'hide' },
    cell: (c) => valueOr(c.getValue()),
  }),
  col.accessor('department', {
    header: 'Подразделение',
    meta: { mobile: 'hide' },
    cell: (c) => valueOr(c.getValue()),
  }),
  col.accessor('type', { header: 'Тип' }),
  col.accessor((r) => `${r.brand} ${r.model}`, { id: 'model', header: 'Марка / модель' }),
  col.accessor('hoseCount', { header: 'Кол-во РВД' }),
  col.accessor('lastRepairDate', {
    header: 'Крайний ремонт',
    meta: { mobile: 'hide' },
    cell: (c) => valueOr(formatDate(c.getValue())),
  }),
  col.accessor('nextPlannedReplacement', {
    header: 'Ближайшая замена',
    cell: (c) => valueOr(formatDate(c.getValue())),
  }),
  col.accessor('statusBreakdown', {
    header: 'Статус техники',
    meta: { mobile: 'full' },
    enableSorting: false,
    cell: (c) => <ProductStatusBar breakdown={c.getValue()} />,
  }),
]
