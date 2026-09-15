import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import type { RequestStatus, ServiceRequest } from '@/entities/types'
import { useRequests } from '@/shared/api/queries'
import { DataTable } from '@/shared/ui/DataTable'
import { formatDate } from '@/shared/lib/utils'

const STATUS: Record<RequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
}

const col = createColumnHelper<ServiceRequest>()
const columns = [
  col.accessor('id', { header: '№' }),
  col.accessor('createdAt', { header: 'Создана', cell: (c) => formatDate(c.getValue()) }),
  col.accessor('kind', {
    header: 'Тип',
    cell: (c) => (c.getValue() === 'replace' ? 'Замена' : 'Изготовление'),
  }),
  col.accessor('productId', { header: 'Изделие', cell: (c) => c.getValue() ?? '—' }),
  col.accessor('quantity', { header: 'Кол-во' }),
  col.accessor('status', { header: 'Статус', cell: (c) => STATUS[c.getValue()] }),
]

export function RequestsPage() {
  const { data = [], isPending } = useRequests()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Заявки</h1>
        <button className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-ink hover:bg-brand-dark">
          Новая заявка
        </button>
      </div>
      {isPending ? (
        <p className="text-ink-muted">Загрузка…</p>
      ) : (
        <DataTable data={data} columns={columns as ColumnDef<ServiceRequest, unknown>[]} />
      )}
    </div>
  )
}
