import { Link } from 'react-router-dom'
import { concernsProduct, REQUEST_KIND_LABEL, RequestStatusBadge } from '@/entities/request'
import { useRequests } from '@/shared/api/queries'
import { formatDate } from '@/shared/lib/utils'
import { EmptyState, QueryState, Skeleton } from '@/shared/ui'
import { RequestNumber } from './RequestNumber'

/**
 * The hose's repairs and replacements as the company asked for them (ТЗ 3.3
 * «история ремонтов и замен»): every request naming it, newest first, with
 * where 1С has got to. The company's list is small and already cached for
 * «Заявки», so the card filters it rather than asking the server again.
 */
export function ProductRequests({ productId, branchId }: { productId: string; branchId: string }) {
  // The hose's own branch: a card opened from search or a link may lie outside the scope.
  const query = useRequests(branchId)
  return (
    <QueryState query={query} skeleton={<Skeleton className="h-16 w-full" />}>
      {(all) => {
        const list = all
          .filter((r) => concernsProduct(r, productId))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        return list.length ? (
          <>
            <ul className="-my-3 divide-y divide-line">
              {list.map((r) => (
                <li key={r.id} className="grid gap-0.5 py-3">
                  <div className="flex items-baseline justify-between gap-3 text-label text-ink-muted">
                    <span>
                      <span className="tabular">{formatDate(r.createdAt)}</span> ·{' '}
                      {REQUEST_KIND_LABEL[r.kind]}
                    </span>
                    <RequestStatusBadge status={r.status} />
                  </div>
                  <div className="text-ui">
                    <RequestNumber request={r} />
                  </div>
                  {r.comment && <div className="text-label text-ink-muted">{r.comment}</div>}
                </li>
              ))}
            </ul>
            <Link
              to="/requests"
              className="mt-5 inline-block text-ui text-brand-deep hover:underline"
            >
              Все заявки компании
            </Link>
          </>
        ) : (
          <EmptyState
            inset
            title="Заявок по этому изделию не было"
            description="Заявки на замену и ремонт этого рукава появятся здесь вместе со статусом в 1С."
          />
        )
      }}
    </QueryState>
  )
}
