import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, Pencil, RefreshCw } from 'lucide-react'
import { ProductStatusBadge } from '@/entities/product'
import { useProduct } from '@/shared/api/queries'
import { Badge, Button, PageHeader, QueryState, Skeleton } from '@/shared/ui'
import { ProductAttachments } from '@/features/attachments/ProductAttachments'
import { ProductReplacements } from '@/features/replacements/components/ProductReplacements'
import { ReplacementDialog } from '@/features/replacements/components/ReplacementDialog'
import { ProductComposition } from './components/ProductComposition'
import { ProductDetails } from './components/ProductDetails'
import { ProductEditForm } from './components/ProductEditForm'
import { ProductLifecycle } from './components/ProductLifecycle'

export function ProductPage() {
  const { id = '' } = useParams()
  const query = useProduct(id)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [replacing, setReplacing] = useState(false)
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
                Изделие {p.serialNumber}{' '}
                {/* A written-off hose has no health to report — say where it is instead. */}
                {p.lifecycle === 'written_off' ? (
                  <Badge tone="none" dot>
                    Списано
                  </Badge>
                ) : (
                  <ProductStatusBadge status={p.status} />
                )}
              </>
            }
            description={`${p.type} · ${p.manufacturer}`}
            actions={
              <>
                {/* Phones: three actions share the pinned bar, so the labels shorten. */}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Pencil}
                  aria-label="Изменить"
                  onClick={() => setEditing(true)}
                  disabled={p.lifecycle === 'written_off'}
                  className="max-sm:flex-none!"
                >
                  <span className="max-sm:sr-only">Изменить</span>
                </Button>
                {p.installedAt && p.lifecycle !== 'written_off' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ArrowLeftRight}
                    onClick={() => setReplacing(true)}
                  >
                    <span className="sm:hidden">Замена</span>
                    <span className="max-sm:hidden">Зафиксировать замену</span>
                  </Button>
                )}
                <Button size="sm" icon={RefreshCw} onClick={() => navigate('/requests')}>
                  <span className="sm:hidden">Заявка</span>
                  <span className="max-sm:hidden">Создать заявку на замену</span>
                </Button>
              </>
            }
          />
          {editing && <ProductEditForm product={p} onClose={() => setEditing(false)} />}
          {replacing && <ReplacementDialog product={p} onClose={() => setReplacing(false)} />}
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <div className="grid gap-5">
              <ProductDetails product={p} />
              <ProductAttachments productId={p.id} readOnly={p.lifecycle === 'written_off'} />
            </div>
            <div className="grid gap-5">
              <ProductLifecycle productId={p.id} />
              <ProductComposition lines={p.composition} />
              <ProductReplacements productId={p.id} />
            </div>
          </div>
        </div>
      )}
    </QueryState>
  )
}
