import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Copy, Pencil, RefreshCw } from 'lucide-react'
import { ProductStatusBadge } from '@/entities/product'
import { useProduct } from '@/shared/api/queries'
import { readOrigin } from '@/shared/lib/origin'
import { Badge, Button, PageHeader, QueryState, Skeleton } from '@/shared/ui'
import { ProductAttachments } from '@/features/attachments/ProductAttachments'
import { RequestForm, type RequestPreset } from '@/features/requests/components/RequestForm'
import { ContactDialog, type ContactPreset } from '@/features/support/ContactDialog'
import { ProductActivity } from './components/ProductActivity'
import { ProductComposition } from './components/ProductComposition'
import { ProductDetails } from './components/ProductDetails'
import { ProductEditForm } from './components/ProductEditForm'
import { ProductLifetime } from './components/ProductLifetime'

export function ProductPage() {
  const { id = '' } = useParams()
  const query = useProduct(id)
  const origin = readOrigin({ to: '/products', label: 'К списку изделий' })
  const [editing, setEditing] = useState(false)
  const [requesting, setRequesting] = useState<RequestPreset | null>(null)
  const [contact, setContact] = useState<ContactPreset | null>(null)
  return (
    <QueryState query={query} skeleton={<Skeleton className="sheet h-96" />}>
      {(p) => (
        <div>
          <PageHeader
            stickyActions
            backTo={origin.to}
            backLabel={origin.label}
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
            description={[p.type, p.manufacturer].filter(Boolean).join(' · ')}
            actions={
              <>
                {/* Phones: both actions share the pinned bar; the edit keeps only its icon. */}
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
                {/* ТЗ 3.3: an identical hose, by its catalogue number — or by this one's EHS, which
                    the manager finds in 1С with its whole bill of materials. */}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Copy}
                  aria-label="Заказать такой же"
                  onClick={() =>
                    setRequesting({
                      kind: 'manufacture',
                      catalogNumber: p.catalogNumber ?? `как EHS ${p.serialNumber}`,
                    })
                  }
                  className="max-sm:flex-none!"
                >
                  <span className="max-sm:sr-only">Заказать такой же</span>
                </Button>
                {/* The supplier replaces and writes off in 1С; the customer asks for it. */}
                <Button
                  size="sm"
                  icon={RefreshCw}
                  onClick={() => setRequesting({ kind: 'replace', products: [p] })}
                >
                  <span className="sm:hidden">Заявка на замену</span>
                  <span className="max-sm:hidden">Создать заявку на замену</span>
                </Button>
              </>
            }
          />
          {editing && (
            <ProductEditForm
              product={p}
              onClose={() => setEditing(false)}
              onAskDate={() => {
                setEditing(false)
                setContact({ topic: 'install_date', product: p })
              }}
            />
          )}
          {requesting && <RequestForm preset={requesting} onClose={() => setRequesting(null)} />}
          {contact && <ContactDialog preset={contact} onClose={() => setContact(null)} />}
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <ProductLifetime
              productId={p.id}
              onAskDate={
                p.lifecycle === 'written_off'
                  ? undefined
                  : () => setContact({ topic: 'install_date', product: p })
              }
            />
            <div className="grid gap-5">
              <ProductDetails
                product={p}
                onAskDate={
                  p.lifecycle === 'written_off'
                    ? undefined
                    : () => setContact({ topic: 'install_date', product: p })
                }
              />
              <ProductAttachments productId={p.id} readOnly={p.lifecycle === 'written_off'} />
            </div>
            <div className="grid gap-5">
              <ProductActivity productId={p.id} branchId={p.branchId} />
              <ProductComposition productId={p.id} lines={p.composition} />
            </div>
          </div>
        </div>
      )}
    </QueryState>
  )
}
