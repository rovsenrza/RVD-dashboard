import { Link } from 'react-router-dom'
import type { Replacement } from '@/entities/types'
import { formatUsage } from '@/entities/replacement'
import { useProductReplacements } from '@/shared/api/queries'
import { formatDate } from '@/shared/lib/utils'
import { Card, EmptyState, QueryState, Skeleton } from '@/shared/ui'
import { AttachmentStrip } from '@/features/attachments/AttachmentStrip'

const hose = (id: string | null, serial: string | null) =>
  id && serial ? (
    <Link to={`/products/${id}`} className="font-medium text-brand-deep hover:underline">
      EHS {serial}
    </Link>
  ) : (
    <span className="text-ink-muted">изделие не из кабинета</span>
  )

/** What happened to this hose, told from its side: taken off, or put on in place of another. */
function Event({ r, productId }: { r: Replacement; productId: string }) {
  return r.oldProductId === productId ? (
    <>
      Снято с {r.garageNumber}, вместо него — {hose(r.newProductId, r.newSerialNumber)}
    </>
  ) : (
    <>
      Установлено на {r.garageNumber} вместо {hose(r.oldProductId, r.oldSerialNumber)}
    </>
  )
}

export function ProductReplacements({ productId }: { productId: string }) {
  const query = useProductReplacements(productId)
  return (
    <Card title="История замен">
      <QueryState query={query} skeleton={<Skeleton className="h-16 w-full" />}>
        {(list) =>
          list.length ? (
            <ul className="-my-3 divide-y divide-line">
              {list.map((r) => {
                const usage = formatUsage(r)
                return (
                  <li key={r.id} className="grid gap-0.5 py-3">
                    <div className="flex items-baseline justify-between gap-3 text-label text-ink-muted">
                      <span>
                        <span className="tabular">{formatDate(r.date)}</span> · {r.reason}
                      </span>
                      {usage && <span className="tabular">{usage}</span>}
                    </div>
                    <div className="text-ui">
                      <Event r={r} productId={productId} />
                    </div>
                    <div className="text-label text-ink-muted">
                      {r.performedBy}
                      {r.comment && ` · ${r.comment}`}
                    </div>
                    <AttachmentStrip files={r.attachments} />
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              inset
              title="Замен ещё не было"
              description="Когда это изделие снимут или поставят на замену другому, запись появится здесь."
            />
          )
        }
      </QueryState>
    </Card>
  )
}
