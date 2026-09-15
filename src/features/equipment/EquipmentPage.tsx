import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import type { Equipment } from '@/entities/types'
import { useEquipment } from '@/shared/api/queries'
import { DataTable } from '@/shared/ui/DataTable'
import { StatusBar } from '@/shared/ui/StatusBar'
import { formatDate } from '@/shared/lib/utils'

const col = createColumnHelper<Equipment>()
const columns = [
  col.accessor('garageNumber', {
    header: 'Гаражный №',
    cell: (c) => <span className="font-medium text-brand-dark">{c.getValue()}</span>,
  }),
  col.accessor((r) => `${r.brand} ${r.model}`, { id: 'model', header: 'Марка / модель' }),
  col.accessor('hoseCount', { header: 'Кол-во РВД' }),
  col.accessor('lastRepairDate', {
    header: 'Крайний ремонт',
    cell: (c) => formatDate(c.getValue()),
  }),
  col.accessor('nextPlannedReplacement', {
    header: 'Ближайшая замена',
    cell: (c) => formatDate(c.getValue()),
  }),
  col.accessor('statusBreakdown', {
    header: 'Статус техники',
    enableSorting: false,
    cell: (c) => <StatusBar breakdown={c.getValue()} />,
  }),
]

export function EquipmentPage() {
  const { data = [], isPending } = useEquipment()
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Моя техника</h1>
      {isPending ? (
        <p className="text-ink-muted">Загрузка…</p>
      ) : (
        <DataTable data={data} columns={columns as ColumnDef<Equipment, unknown>[]} pageSize={10} />
      )}
    </div>
  )
}
