import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import type { Replacement } from '@/entities/types'
import { useReplacements } from '@/shared/api/queries'
import { DataTable } from '@/shared/ui/DataTable'
import { formatDate } from '@/shared/lib/utils'

const col = createColumnHelper<Replacement>()
const columns = [
  col.accessor('date', { header: 'Дата', cell: (c) => formatDate(c.getValue()) }),
  col.accessor('oldProductId', { header: 'Заменено' }),
  col.accessor('newProductId', { header: 'Установлено', cell: (c) => c.getValue() ?? '—' }),
  col.accessor('equipmentId', { header: 'Техника' }),
  col.accessor('reason', { header: 'Причина' }),
  col.accessor('operatingHours', { header: 'Моточасы', cell: (c) => c.getValue() ?? '—' }),
  col.accessor('performedBy', { header: 'Кто выполнил' }),
]

export function ReplacementsPage() {
  const { data = [], isPending } = useReplacements()
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">История замен</h1>
      {isPending ? (
        <p className="text-ink-muted">Загрузка…</p>
      ) : (
        <DataTable data={data} columns={columns as ColumnDef<Replacement, unknown>[]} />
      )}
    </div>
  )
}
