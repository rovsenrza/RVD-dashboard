import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import type { Replacement } from '@/entities/types'
import { useReplacements } from '@/shared/api/queries'
import { Button, DataTable, PageHeader, QueryState, SearchInput, TableSkeleton } from '@/shared/ui'
import { replacementColumns } from './columns'

export function ReplacementsPage() {
  const query = useReplacements()
  const [filter, setFilter] = useState('')
  return (
    <div>
      <PageHeader
        title="История замен"
        description="Журнал всех замен РВД на технике компании"
        actions={
          <Button variant="secondary" size="sm" icon={Download}>
            Экспорт
          </Button>
        }
      />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(data) => (
          <DataTable
            data={data}
            columns={replacementColumns as ColumnDef<Replacement, unknown>[]}
            globalFilter={filter}
            emptyTitle="Замен ещё не было"
            search={
              <SearchInput
                id="replacements-search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Изделие, техника, причина…"
              />
            }
          />
        )}
      </QueryState>
    </div>
  )
}
