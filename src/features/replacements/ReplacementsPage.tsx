import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import { formatISO, subDays } from 'date-fns'
import type { Replacement } from '@/entities/types'
import { useReplacements } from '@/shared/api/queries'
import {
  Button,
  Chip,
  DataTable,
  PageHeader,
  QueryState,
  SearchInput,
  TableSkeleton,
} from '@/shared/ui'
import { replacementColumns } from './columns'

export function ReplacementsPage() {
  const query = useReplacements()
  const [filter, setFilter] = useState('')
  const [params, setParams] = useSearchParams()
  const period = Number(params.get('period')) || null

  const rows = useMemo(() => {
    const all = query.data ?? []
    if (!period) return all
    const from = formatISO(subDays(new Date(), period), { representation: 'date' })
    return all.filter((r) => r.date >= from)
  }, [query.data, period])

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
        {() => (
          <DataTable
            data={rows}
            columns={replacementColumns as ColumnDef<Replacement, unknown>[]}
            globalFilter={filter}
            emptyTitle="Замен ещё не было"
            toolbar={
              period ? (
                <Chip
                  onRemove={() => {
                    params.delete('period')
                    setParams(params)
                  }}
                >
                  За последние {period} дней
                </Chip>
              ) : undefined
            }
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
