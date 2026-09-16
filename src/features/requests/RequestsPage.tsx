import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import type { ServiceRequest } from '@/entities/types'
import { useRequests } from '@/shared/api/queries'
import { Button, DataTable, PageHeader, QueryState, TableSkeleton } from '@/shared/ui'
import { requestColumns } from './columns'

export function RequestsPage() {
  const query = useRequests()
  return (
    <div className="space-y-4">
      <PageHeader title="Заявки" actions={<Button icon={Plus}>Новая заявка</Button>} />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(data) => (
          <DataTable
            data={data}
            columns={requestColumns as ColumnDef<ServiceRequest, unknown>[]}
            emptyTitle="Заявок пока нет"
          />
        )}
      </QueryState>
    </div>
  )
}
