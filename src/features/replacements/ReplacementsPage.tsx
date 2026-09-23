import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, Download } from 'lucide-react'
import { formatISO, subDays } from 'date-fns'
import type { Replacement } from '@/entities/types'
import { USAGE_UNIT_LABEL } from '@/entities/replacement'
import { useReplacements } from '@/shared/api/queries'
import { ReplacementDialog } from './components/ReplacementDialog'
import {
  Button,
  Chip,
  DataTable,
  PageHeader,
  QueryState,
  SearchInput,
  TableSkeleton,
} from '@/shared/ui'
import { downloadCsv, type CsvColumn } from '@/shared/lib/csv'
import { replacementColumns } from './columns'

const CSV_COLUMNS: CsvColumn<Replacement>[] = [
  { header: 'Дата', value: (r) => r.date },
  { header: 'Снятое изделие (EHS)', value: (r) => r.oldSerialNumber },
  { header: 'Установленное изделие (EHS)', value: (r) => r.newSerialNumber },
  { header: 'Техника (гаражный №)', value: (r) => r.garageNumber },
  { header: 'Причина', value: (r) => r.reason },
  { header: 'Наработка', value: (r) => r.operatingHours },
  { header: 'Единица', value: (r) => USAGE_UNIT_LABEL[r.usageUnit] },
  { header: 'Исполнитель', value: (r) => r.performedBy },
  { header: 'Комментарий', value: (r) => r.comment },
]

export function ReplacementsPage() {
  const query = useReplacements()
  const [filter, setFilter] = useState('')
  const [recording, setRecording] = useState(false)
  const navigate = useNavigate()
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
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={() => downloadCsv('замены.csv', CSV_COLUMNS, rows)}
            >
              Экспорт
            </Button>
            <Button size="sm" icon={ArrowLeftRight} onClick={() => setRecording(true)}>
              Зафиксировать замену
            </Button>
          </>
        }
      />
      {recording && <ReplacementDialog onClose={() => setRecording(false)} />}
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {() => (
          <DataTable
            data={rows}
            columns={replacementColumns as ColumnDef<Replacement, unknown>[]}
            globalFilter={filter}
            onRowClick={(r) => navigate(`/products/${r.oldProductId}`)}
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
