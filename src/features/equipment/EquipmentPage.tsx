import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import type { Equipment } from '@/entities/types'
import { useSession } from '@/app/session'
import { useEquipment } from '@/shared/api/queries'
import {
  DataTable,
  ExportMenu,
  PageHeader,
  QueryState,
  SearchInput,
  SegmentedControl,
  TableSkeleton,
  type DataTableHandle,
} from '@/shared/ui'
import type { ExportColumn } from '@/shared/lib/export'
import { equipmentColumns } from './columns'
import { EquipmentTree } from './components/EquipmentTree'

const EXPORT_COLUMNS: ExportColumn<Equipment>[] = [
  { header: 'Гаражный №', value: (e) => e.garageNumber, width: 10 },
  { header: 'Заводской №', value: (e) => e.factoryNumber, width: 14 },
  { header: 'Инвентарный №', value: (e) => e.inventoryNumber, width: 13 },
  { header: 'Подразделение', value: (e) => e.department, width: 22 },
  { header: 'Тип', value: (e) => e.type, width: 14 },
  { header: 'Марка', value: (e) => e.brand, width: 12 },
  { header: 'Модель', value: (e) => e.model, width: 12 },
  { header: 'Кол-во РВД', value: (e) => e.hoseCount, width: 9 },
  { header: 'Норма', value: (e) => e.statusBreakdown.ok, width: 8 },
  { header: 'Внимание', value: (e) => e.statusBreakdown.warn, width: 9 },
  { header: 'Требуется замена', value: (e) => e.statusBreakdown.replace, width: 10 },
  { header: 'Не на гарантии', value: (e) => e.statusBreakdown.no_warranty, width: 10 },
  { header: 'Крайний ремонт', value: (e) => e.lastRepairDate, type: 'date', width: 11 },
  {
    header: 'Ближайшая замена',
    value: (e) => e.nextPlannedReplacement,
    type: 'date',
    width: 11,
  },
]

type View = 'table' | 'tree'

/** The tree searches the same fields a person would type: numbers, model, where it works. */
const matches = (e: Equipment, q: string) =>
  [e.garageNumber, e.factoryNumber, e.inventoryNumber, e.brand, e.model, e.type, e.department]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q))

export function EquipmentPage() {
  const query = useEquipment()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const { branch } = useSession()
  const table = useRef<DataTableHandle<Equipment>>(null)
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'tree' ? 'tree' : 'table'

  const q = filter.trim().toLowerCase()
  const found = useMemo(
    () => (query.data ?? []).filter((e) => !q || matches(e, q)),
    [query.data, q],
  )

  const search = (
    <SearchInput
      id="equipment-search"
      value={filter}
      onChange={(e) => setFilter(e.target.value)}
      placeholder="Номер, модель, подразделение…"
    />
  )

  return (
    <div>
      <PageHeader
        title="Моя техника"
        description="Единицы техники и состояние установленных на них РВД"
        actions={
          <>
            {/* On the field ground the track needs a shade of its own to read as a control. */}
            <SegmentedControl
              className="bg-line/70"
              label="Вид"
              value={view}
              onChange={(v) => {
                if (v === 'tree') params.set('view', 'tree')
                else params.delete('view')
                setParams(params, { replace: true })
              }}
              options={[
                { value: 'table', label: 'Таблица' },
                { value: 'tree', label: 'По подразделениям' },
              ]}
            />
            <ExportMenu
              fileName="техника"
              title="Моя техника"
              lines={[branch?.name ?? 'Все филиалы', q && `Поиск: «${filter.trim()}»`]}
              columns={EXPORT_COLUMNS}
              rows={() => (view === 'table' ? table.current?.visibleRows() : null) ?? found}
            />
          </>
        }
      />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(data) =>
          view === 'tree' ? (
            <>
              <div className="mb-4 flex justify-end">
                <div className="w-full md:w-80">{search}</div>
              </div>
              <EquipmentTree machines={found} />
            </>
          ) : (
            <DataTable
              data={data}
              columns={equipmentColumns as ColumnDef<Equipment, unknown>[]}
              pageSize={10}
              handle={table}
              onRowClick={(e) => navigate(`/equipment/${e.id}`)}
              stickyFirstColumn
              tools
              hiddenByDefault={['factoryNumber']}
              globalFilter={filter}
              emptyTitle="Техника не добавлена"
              search={search}
            />
          )
        }
      </QueryState>
    </div>
  )
}
