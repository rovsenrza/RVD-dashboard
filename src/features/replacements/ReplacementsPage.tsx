import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight } from 'lucide-react'
import { formatISO, subDays } from 'date-fns'
import type { Replacement } from '@/entities/types'
import { REPLACEMENT_REASONS, USAGE_UNIT_LABEL } from '@/entities/replacement'
import { useSession } from '@/app/session'
import { useReplacements } from '@/shared/api/queries'
import { ReplacementDialog } from './components/ReplacementDialog'
import {
  Button,
  DataTable,
  ExportMenu,
  PageHeader,
  QueryState,
  SearchInput,
  Select,
  TableSkeleton,
  type DataTableHandle,
} from '@/shared/ui'
import type { ExportColumn } from '@/shared/lib/export'
import { replacementColumns } from './columns'

const EXPORT_COLUMNS: ExportColumn<Replacement>[] = [
  { header: 'Дата', value: (r) => r.date, type: 'date', width: 11 },
  { header: 'Снятое изделие (EHS)', value: (r) => r.oldSerialNumber, width: 12 },
  { header: 'Установленное изделие (EHS)', value: (r) => r.newSerialNumber, width: 14 },
  { header: 'Техника (гаражный №)', value: (r) => r.garageNumber, width: 12 },
  { header: 'Причина', value: (r) => r.reason, width: 20 },
  { header: 'Наработка', value: (r) => r.operatingHours, width: 10 },
  { header: 'Единица', value: (r) => USAGE_UNIT_LABEL[r.usageUnit], width: 8 },
  { header: 'Исполнитель', value: (r) => r.performedBy, width: 14 },
  { header: 'Комментарий', value: (r) => r.comment, width: 30 },
  { header: 'Файлы', value: (r) => r.attachments.map((a) => a.fileName).join(', '), width: 24 },
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
  const { branch } = useSession()
  const table = useRef<DataTableHandle<Replacement>>(null)
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
            <ExportMenu
              fileName="замены"
              title="История замен"
              lines={[
                branch?.name ?? 'Все филиалы',
                period && PERIODS.find((p) => p.value === period)?.label,
                machine && `Техника: ${machines.find(([id]) => id === machine)?.[1] ?? machine}`,
                reason && `Причина: ${reason}`,
                filter.trim() && `Поиск: «${filter.trim()}»`,
              ]}
              columns={EXPORT_COLUMNS}
              rows={() => table.current?.visibleRows() ?? rows}
            />
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
            handle={table}
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
