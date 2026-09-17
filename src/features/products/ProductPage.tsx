import { useParams } from 'react-router-dom'
import { Pencil, RefreshCw } from 'lucide-react'
import { ProductStatusBadge } from '@/entities/product'
import { useProduct } from '@/shared/api/queries'
import { Button, Card, EmptyState, PageHeader, QueryState, Skeleton } from '@/shared/ui'
import { ProductComposition } from './components/ProductComposition'
import { ProductDetails } from './components/ProductDetails'
import { ProductLifecycle } from './components/ProductLifecycle'

export function ProductPage() {
  const { id = '' } = useParams()
  const query = useProduct(id)
  return (
    <QueryState query={query} skeleton={<Skeleton className="sheet h-96" />}>
      {(p) => (
        <div>
          <PageHeader
            backTo="/products"
            backLabel="К списку изделий"
            title={
              <>
                Изделие {p.serialNumber} <ProductStatusBadge status={p.status} />
              </>
            }
            description={`${p.type} · ${p.manufacturer}`}
            actions={
              <>
                <Button variant="secondary" size="sm" icon={Pencil}>
                  Изменить
                </Button>
                <Button size="sm" icon={RefreshCw}>
                  Создать заявку на замену
                </Button>
              </>
            }
          />
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <ProductDetails product={p} />
            <div className="grid gap-5">
              <ProductLifecycle productId={p.id} />
              <ProductComposition lines={p.composition} />
              <Card title="История замен и ремонтов">
                <EmptyState
                  inset
                  title="Замен ещё не было"
                  description="Здесь появится журнал замен и ремонтов этого изделия из 1С."
                />
              </Card>
            </div>
          </div>
        </div>
      )}
    </QueryState>
  )
}
