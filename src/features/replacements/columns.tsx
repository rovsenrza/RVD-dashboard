import { createColumnHelper } from '@tanstack/react-table'
import type { Replacement } from '@/entities/types'
import { formatDate } from '@/shared/lib/utils'

const col = createColumnHelper<Replacement>()

export const replacementColumns = [
  col.accessor('date', { header: 'Дата', cell: (c) => formatDate(c.getValue()) }),
  col.accessor('oldProductId', { header: 'Заменено' }),
  col.accessor('newProductId', { header: 'Установлено', cell: (c) => c.getValue() ?? '—' }),
  col.accessor('equipmentId', { header: 'Техника' }),
  col.accessor('reason', { header: 'Причина' }),
  col.accessor('operatingHours', { header: 'Моточасы', cell: (c) => c.getValue() ?? '—' }),
  col.accessor('performedBy', { header: 'Кто выполнил' }),
]
