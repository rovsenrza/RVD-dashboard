import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import type { ServiceRequest } from '@/entities/types'
import { useRequests } from '@/shared/api/queries'
import { Button, DataTable, PageHeader, QueryState, Tabs, TableSkeleton } from '@/shared/ui'
import { requestColumns } from './columns'
import { RequestForm } from './components/RequestForm'

type Tab = 'all' | 'open' | 'done'

export function RequestsPage() {
  const query = useRequests()
  const [tab, setTab] = useState<Tab>('all')
  const [formOpen, setFormOpen] = useState(false)
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
          <Button icon={Plus} onClick={() => setFormOpen(true)}>
            Новая заявка
          </Button>
        }
      />
      <RequestForm open={formOpen} onClose={() => setFormOpen(false)} />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {() => (
          <DataTable
            data={rows}
            columns={requestColumns as ColumnDef<ServiceRequest, unknown>[]}
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
