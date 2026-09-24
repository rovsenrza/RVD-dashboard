import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, RefreshCw } from 'lucide-react'
import type { Replacement } from '@/entities/types'
import { ProductStatusBar } from '@/entities/product'
import { useSession } from '@/app/session'
import { useEquipmentItem, useEquipmentReplacements } from '@/shared/api/queries'
import {
  Button,
  Card,
  DataTable,
  DescriptionList,
  PageHeader,
  QueryState,
  Skeleton,
} from '@/shared/ui'
import { formatDate } from '@/shared/lib/utils'
import { replacementColumns } from '@/features/replacements/columns'
import { ReplacementDialog } from '@/features/replacements/components/ReplacementDialog'
import { HosesByPlace } from './components/HosesByPlace'

export function EquipmentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { branches } = useSession()
  const query = useEquipmentItem(id)
  const history = useEquipmentReplacements(id)
  const [replacing, setReplacing] = useState(false)

  return (
    <QueryState query={query} skeleton={<Skeleton className="sheet h-96" />}>
      {(e) => (
        <div>
          <PageHeader
            stickyActions
            backTo="/equipment"
            backLabel="К списку техники"
            title={`${e.garageNumber} · ${e.brand} ${e.model}`}
            description={`${e.type} · ${e.hoseCount} РВД на технике`}
            actions={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ArrowLeftRight}
                  onClick={() => setReplacing(true)}
                  disabled={!e.hoseCount}
                >
                  <span className="sm:hidden">Замена</span>
                  <span className="max-sm:hidden">Зафиксировать замену</span>
                </Button>
                <Button size="sm" icon={RefreshCw} onClick={() => navigate('/requests')}>
                  Заявка на замену
                </Button>
              </>
            }
          />
          {replacing && (
            <ReplacementDialog equipmentId={e.id} onClose={() => setReplacing(false)} />
          )}

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
            <Card title="Карточка техники">
              <DescriptionList
                termWidth={120}
                items={[
                  ['Гаражный №', e.garageNumber],
                  ['Заводской №', e.factoryNumber],
                  ['Инвентарный №', e.inventoryNumber],
                  ['Филиал', branches.find((b) => b.id === e.branchId)?.name],
                  ['Подразделение', e.department],
                  ['Тип', e.type],
                  ['Марка', e.brand],
                  ['Модель', e.model],
                  ['Крайний ремонт', formatDate(e.lastRepairDate)],
                  ['Ближайшая замена', formatDate(e.nextPlannedReplacement)],
                ]}
              />
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-2 text-caption font-medium tracking-wide text-ink-muted uppercase">
                  Состояние РВД
                </div>
                <ProductStatusBar breakdown={e.statusBreakdown} />
              </div>
            </Card>

            <Card title="РВД по местам установки">
              <HosesByPlace equipmentId={e.id} />
            </Card>
          </div>

          <Card title="История замен" className="mt-5">
            <QueryState query={history} skeleton={<Skeleton className="h-32" />}>
              {(rows) => (
                <DataTable
                  embedded
                  data={rows}
                  columns={replacementColumns as ColumnDef<Replacement, unknown>[]}
                  pageSize={5}
                  onRowClick={(r) => navigate(`/products/${r.oldProductId}`)}
                  emptyTitle="На этой технике замен ещё не было"
                  hiddenByDefault={['garageNumber']}
                />
              )}
            </QueryState>
          </Card>
        </div>
      )}
    </QueryState>
  )
}
