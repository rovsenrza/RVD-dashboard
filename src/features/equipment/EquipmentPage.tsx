import type { ColumnDef } from '@tanstack/react-table'
import type { Equipment } from '@/entities/types'
import { useEquipment } from '@/shared/api/queries'
import { DataTable, PageHeader, QueryState, TableSkeleton } from '@/shared/ui'
import { equipmentColumns } from './columns'

export function EquipmentPage() {
  const query = useEquipment()
  return (
    <div className="space-y-4">
      <PageHeader title="Моя техника" />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(data) => (
          <DataTable
            data={data}
            columns={equipmentColumns as ColumnDef<Equipment, unknown>[]}
            pageSize={10}
            emptyTitle="Техника не добавлена"
          />
        )}
      </QueryState>
    </div>
  )
}
