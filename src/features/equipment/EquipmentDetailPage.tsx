import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { RefreshCw } from 'lucide-react'
import type { Product } from '@/entities/types'
import { ProductStatusBar } from '@/entities/product'
import { useEquipmentItem, useEquipmentProducts } from '@/shared/api/queries'
import { Button, Card, DataTable, PageHeader, QueryState, Skeleton, valueOr } from '@/shared/ui'
import { formatDate } from '@/shared/lib/utils'
import { productColumns } from '@/features/products/columns'

export function EquipmentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const query = useEquipmentItem(id)
  const products = useEquipmentProducts(id)

  return (
    <QueryState query={query} skeleton={<Skeleton className="sheet h-96" />}>
      {(e) => (
        <div>
          <PageHeader
            backTo="/equipment"
            backLabel="К списку техники"
            title={`${e.garageNumber} · ${e.brand} ${e.model}`}
            description={`${e.type} · ${e.hoseCount} РВД на технике`}
            actions={
              <Button size="sm" icon={RefreshCw} onClick={() => navigate('/requests')}>
                Заявка на замену
              </Button>
            }
          />

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
            <Card title="Карточка техники">
              <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-6 gap-y-1.5 text-ui">
                {(
                  [
                    ['Гаражный №', e.garageNumber],
                    ['Инвентарный №', e.inventoryNumber],
                    ['Тип', e.type],
                    ['Марка', e.brand],
                    ['Модель', e.model],
                    ['Крайний ремонт', formatDate(e.lastRepairDate)],
                    ['Ближайшая замена', formatDate(e.nextPlannedReplacement)],
                  ] as [string, string | null][]
                ).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="tabular">{valueOr(v)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-2 text-caption font-medium tracking-wide text-ink-muted uppercase">
                  Состояние РВД
                </div>
                <ProductStatusBar breakdown={e.statusBreakdown} />
              </div>
            </Card>

            <Card title="Установленные изделия">
              <QueryState query={products} skeleton={<Skeleton className="h-64" />}>
                {(rows) => (
                  <DataTable
                    embedded
                    data={rows}
                    columns={productColumns as ColumnDef<Product, unknown>[]}
                    pageSize={10}
                    onRowClick={(p) => navigate(`/products/${p.id}`)}
                    emptyTitle="На этой технике нет изделий"
                    hiddenByDefault={['oemNumber', 'manufacturer', 'shippedAt']}
                  />
                )}
              </QueryState>
            </Card>
          </div>
        </div>
      )}
    </QueryState>
  )
}
