import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import type { Equipment } from '@/entities/types'
import { useEquipment } from '@/shared/api/queries'
import { Button, DataTable, PageHeader, QueryState, SearchInput, TableSkeleton } from '@/shared/ui'
import { equipmentColumns } from './columns'

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
          <Button variant="secondary" size="sm" icon={Download}>
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
