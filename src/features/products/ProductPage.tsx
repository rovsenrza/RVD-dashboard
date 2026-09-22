import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, RefreshCw } from 'lucide-react'
import { ProductStatusBadge } from '@/entities/product'
import { useProduct } from '@/shared/api/queries'
import { Button, Card, EmptyState, PageHeader, QueryState, Skeleton } from '@/shared/ui'
import { ProductComposition } from './components/ProductComposition'
import { ProductDetails } from './components/ProductDetails'
import { ProductEditForm } from './components/ProductEditForm'
import { ProductLifecycle } from './components/ProductLifecycle'

export function ProductPage() {
  const { id = '' } = useParams()
  const query = useProduct(id)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  return (
    <QueryState query={query} skeleton={<Skeleton className="sheet h-96" />}>
      {(p) => (
        <div>
          <PageHeader
            stickyActions
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
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Pencil}
                  onClick={() => setEditing(true)}
                  disabled={p.lifecycle === 'written_off'}
                >
                  Изменить
                </Button>
                <Button size="sm" icon={RefreshCw} onClick={() => navigate('/requests')}>
                  Создать заявку на замену
                </Button>
              </>
            }
          />
          {editing && <ProductEditForm product={p} onClose={() => setEditing(false)} />}
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
