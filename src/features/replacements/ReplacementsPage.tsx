import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, Download } from 'lucide-react'
import { formatISO, subDays } from 'date-fns'
import type { Replacement } from '@/entities/types'
import { REPLACEMENT_REASONS, USAGE_UNIT_LABEL } from '@/entities/replacement'
import { useReplacements } from '@/shared/api/queries'
import { ReplacementDialog } from './components/ReplacementDialog'
import {
  Button,
  DataTable,
  PageHeader,
  QueryState,
  SearchInput,
  Select,
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

const PERIODS = [
  { value: '30', label: 'За 30 дней' },
  { value: '90', label: 'За 90 дней' },
  { value: '365', label: 'За год' },
]

export function ReplacementsPage() {
  const query = useReplacements()
  const [filter, setFilter] = useState('')
  const [recording, setRecording] = useState(false)
  const navigate = useNavigate()
  // Filters live in the URL, so a KPI link («Замен за 30 дней») and a shared link open the same slice.
  const [params, setParams] = useSearchParams()
  const period = params.get('period') ?? ''
  const machine = params.get('machine') ?? ''
  const reason = params.get('reason') ?? ''
  const setParam = (key: string, value: string) => {
    if (value) params.set(key, value)
    else params.delete(key)
    setParams(params, { replace: true })
  }

  const machines = useMemo(
    () =>
      [...new Map((query.data ?? []).map((r) => [r.equipmentId, r.garageNumber]))].sort((a, b) =>
        a[1].localeCompare(b[1], 'ru'),
      ),
    [query.data],
  )

  const rows = useMemo(() => {
    const from = period
      ? formatISO(subDays(new Date(), Number(period)), { representation: 'date' })
      : ''
    return (query.data ?? []).filter(
      (r) =>
        (!from || r.date >= from) &&
        (!machine || r.equipmentId === machine) &&
        (!reason || r.reason === reason),
    )
  }, [query.data, period, machine, reason])

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
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <Select
                  aria-label="Период"
                  value={period}
                  onChange={(e) => setParam('period', e.target.value)}
                  placeholder="За всё время"
                  options={PERIODS}
                  className="sm:w-40"
                />
                <Select
                  aria-label="Техника"
                  value={machine}
                  onChange={(e) => setParam('machine', e.target.value)}
                  placeholder="Вся техника"
                  options={machines.map(([id, garage]) => ({ value: id, label: garage }))}
                  className="sm:w-36"
                />
                <Select
                  aria-label="Причина"
                  value={reason}
                  onChange={(e) => setParam('reason', e.target.value)}
                  placeholder="Все причины"
                  options={REPLACEMENT_REASONS.map((r) => ({ value: r, label: r }))}
                  className="col-span-2 sm:w-52"
                />
              </div>
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
