import type { ColumnDef } from '@tanstack/react-table'
import type { Replacement } from '@/entities/types'
import { useReplacements } from '@/shared/api/queries'
import { DataTable, PageHeader, QueryState, TableSkeleton } from '@/shared/ui'
import { replacementColumns } from './columns'

export function ReplacementsPage() {
  const query = useReplacements()
  return (
    <div className="space-y-4">
      <PageHeader title="История замен" />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(data) => (
          <DataTable
            data={data}
            columns={replacementColumns as ColumnDef<Replacement, unknown>[]}
            emptyTitle="Замен ещё не было"
          />
        )}
      </QueryState>
    </div>
  )
}
