import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import type { Equipment } from '@/entities/types'
import { useEquipment } from '@/shared/api/queries'
import { Button, DataTable, PageHeader, QueryState, SearchInput, TableSkeleton } from '@/shared/ui'
import { downloadCsv, type CsvColumn } from '@/shared/lib/csv'
import { equipmentColumns } from './columns'

const CSV_COLUMNS: CsvColumn<Equipment>[] = [
  { header: 'Гаражный №', value: (e) => e.garageNumber },
  { header: 'Инвентарный №', value: (e) => e.inventoryNumber },
  { header: 'Тип', value: (e) => e.type },
  { header: 'Марка', value: (e) => e.brand },
  { header: 'Модель', value: (e) => e.model },
  { header: 'Кол-во РВД', value: (e) => e.hoseCount },
  { header: 'Норма', value: (e) => e.statusBreakdown.ok },
  { header: 'Внимание', value: (e) => e.statusBreakdown.warn },
  { header: 'Требуется замена', value: (e) => e.statusBreakdown.replace },
  { header: 'Не на гарантии', value: (e) => e.statusBreakdown.no_warranty },
  { header: 'Крайний ремонт', value: (e) => e.lastRepairDate },
  { header: 'Ближайшая замена', value: (e) => e.nextPlannedReplacement },
]

export function EquipmentPage() {
  const query = useEquipment()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  return (
    <div>
      <PageHeader
        title="Моя техника"
        description="Единицы техники и состояние установленных на них РВД"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={() => downloadCsv('техника.csv', CSV_COLUMNS, query.data ?? [])}
          >
            Экспорт
          </Button>
        }
      />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(data) => (
          <DataTable
            data={data}
            columns={equipmentColumns as ColumnDef<Equipment, unknown>[]}
            pageSize={10}
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
