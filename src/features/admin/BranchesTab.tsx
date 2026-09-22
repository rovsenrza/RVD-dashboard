import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Info } from 'lucide-react'
import type { BranchSummary } from '@/entities/types'
import { useBranchSummaries } from '@/shared/api/queries'
import { DataTable, QueryState, TableSkeleton, valueOr } from '@/shared/ui'

const col = createColumnHelper<BranchSummary>()

const columns = [
  col.accessor('name', {
    header: 'Филиал',
    cell: (c) => <span className="font-medium">{c.getValue()}</span>,
  }),
  col.accessor('code', {
    header: 'Код в 1С',
    cell: (c) => <span className="text-ink-secondary">{c.getValue()}</span>,
  }),
  col.accessor('address', { header: 'Адрес', cell: (c) => valueOr(c.getValue()) }),
  col.accessor('equipmentCount', { header: 'Техника' }),
  col.accessor('productCount', { header: 'РВД в работе' }),
  col.accessor('userCount', { header: 'Пользователи' }),
] as ColumnDef<BranchSummary, unknown>[]

/** Branches are 1С's: the cabinet reads them and counts what it holds for each. */
export function BranchesTab() {
  const branches = useBranchSummaries()
  return (
    <QueryState query={branches} skeleton={<TableSkeleton rows={3} />}>
      {(list) => (
        <DataTable
          data={list}
          columns={columns}
          toolbar={
            <p className="flex items-center gap-2 text-ui text-ink-muted">
              <Info size={15} strokeWidth={1.75} className="shrink-0" />
              Филиалы ведутся в 1С и здесь только читаются
            </p>
          }
        />
      )}
    </QueryState>
  )
}
