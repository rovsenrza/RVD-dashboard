import { useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ProductStatusBadge } from '@/entities/product'
import { useProduct } from '@/shared/api/queries'
import { Button, Card, PageHeader, QueryState, Skeleton } from '@/shared/ui'
import { ProductDetails } from './components/ProductDetails'

export function ProductPage() {
  const { id = '' } = useParams()
  const query = useProduct(id)
  return (
    <QueryState query={query} skeleton={<Skeleton className="h-96" />}>
      {(p) => (
        <div className="space-y-4">
          <PageHeader
            backTo="/products"
            backLabel="К списку"
            title={
              <>
                Изделие {p.serialNumber} <ProductStatusBadge status={p.status} />
              </>
            }
            actions={<Button icon={RefreshCw}>Создать заявку на замену</Button>}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <ProductDetails product={p} />
            <Card title="История замен и ремонтов">
              <p className="text-sm text-ink-muted">Будет заполнено из журнала замен (ТЗ 3.5).</p>
            </Card>
          </div>
        </div>
      )}
    </QueryState>
  )
}
