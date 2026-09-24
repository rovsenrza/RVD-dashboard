import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  TableSkeleton,
  type DataTableHandle,
} from '@/shared/ui'
import type { ExportColumn } from '@/shared/lib/export'
import { equipmentColumns } from './columns'

const EXPORT_COLUMNS: ExportColumn<Equipment>[] = [
  { header: 'Гаражный №', value: (e) => e.garageNumber, width: 10 },
  { header: 'Инвентарный №', value: (e) => e.inventoryNumber, width: 13 },
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

export function EquipmentPage() {
  const query = useEquipment()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const { branch } = useSession()
  const table = useRef<DataTableHandle<Equipment>>(null)
  return (
    <div>
      <PageHeader
        title="Моя техника"
        description="Единицы техники и состояние установленных на них РВД"
        actions={
          <ExportMenu
            fileName="техника"
            title="Моя техника"
            lines={[branch?.name ?? 'Все филиалы', filter.trim() && `Поиск: «${filter.trim()}»`]}
            columns={EXPORT_COLUMNS}
            rows={() => table.current?.visibleRows() ?? query.data ?? []}
          />
        }
      />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(data) => (
          <DataTable
            data={data}
            columns={equipmentColumns as ColumnDef<Equipment, unknown>[]}
            pageSize={10}
            handle={table}
            onRowClick={(e) => navigate(`/equipment/${e.id}`)}
            stickyFirstColumn
            tools
            globalFilter={filter}
            emptyTitle="Техника не добавлена"
            search={
              <SearchInput
                id="equipment-search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Гаражный номер, марка, модель…"
              />
            }
          />
        )}
      </QueryState>
    </div>
  )
}
