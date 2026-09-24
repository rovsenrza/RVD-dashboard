import { useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import type { ServiceRequest } from '@/entities/types'
import { useSession } from '@/app/session'
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL } from '@/entities/request'
import { useRequests } from '@/shared/api/queries'
import type { ExportColumn } from '@/shared/lib/export'
import {
  Button,
  DataTable,
  ExportMenu,
  PageHeader,
  QueryState,
  Tabs,
  TableSkeleton,
  type DataTableHandle,
} from '@/shared/ui'
import { requestColumns } from './columns'
import { RequestForm } from './components/RequestForm'

type Tab = 'all' | 'open' | 'done'

const TAB_LABEL: Record<Tab, string | null> = { all: null, open: 'В работе', done: 'Закрытые' }

const EXPORT_COLUMNS: ExportColumn<ServiceRequest>[] = [
  { header: '№', value: (r) => r.number, width: 13 },
  { header: 'Создана', value: (r) => r.createdAt, type: 'date', width: 11 },
  { header: 'Тип', value: (r) => REQUEST_KIND_LABEL[r.kind], width: 13 },
  {
    header: 'Каталожный №',
    value: (r) =>
      r.positions
        .map((p) => p.catalogNumber)
        .filter(Boolean)
        .join(', '),
    width: 18,
  },
  { header: 'Кол-во', value: (r) => r.quantity, width: 8 },
  { header: 'Статус', value: (r) => REQUEST_STATUS_LABEL[r.status], width: 12 },
  {
    header: 'Отгрузка',
    value: (r) => (r.shipmentStatus === 'shipped' ? 'Отгружен' : 'Не отгружен'),
    width: 12,
  },
  { header: 'Комментарий', value: (r) => r.comment, width: 30 },
  { header: 'Файлы', value: (r) => r.attachments.map((a) => a.fileName).join(', '), width: 24 },
]

export function RequestsPage() {
  const query = useRequests()
  const [tab, setTab] = useState<Tab>('all')
  const [formOpen, setFormOpen] = useState(false)
  const { branch } = useSession()
  const table = useRef<DataTableHandle<ServiceRequest>>(null)
  const all = query.data ?? []
  const rows =
    tab === 'open'
      ? all.filter((r) => r.status === 'new' || r.status === 'in_progress')
      : tab === 'done'
        ? all.filter((r) => r.status === 'done' || r.status === 'rejected')
        : all

  return (
    <div>
      <PageHeader
        title="Заявки"
        description="Заявки на замену и изготовление РВД"
        actions={
          <>
            <ExportMenu
              fileName="заявки"
              title="Заявки"
              lines={[branch?.name ?? 'Все филиалы', TAB_LABEL[tab]]}
              columns={EXPORT_COLUMNS}
              rows={() => table.current?.visibleRows() ?? rows}
            />
            <Button icon={Plus} onClick={() => setFormOpen(true)}>
              Новая заявка
            </Button>
          </>
        }
      />
      <RequestForm open={formOpen} onClose={() => setFormOpen(false)} />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {() => (
          <DataTable
            data={rows}
            columns={requestColumns as ColumnDef<ServiceRequest, unknown>[]}
            handle={table}
            emptyTitle="Заявок пока нет"
            toolbar={
              <Tabs
                items={[
                  { key: 'all', label: 'Все', count: all.length },
                  { key: 'open', label: 'В работе' },
                  { key: 'done', label: 'Закрытые' },
                ]}
                value={tab}
                onChange={setTab}
                className="border-b-0"
              />
            }
          />
        )}
      </QueryState>
    </div>
  )
}
