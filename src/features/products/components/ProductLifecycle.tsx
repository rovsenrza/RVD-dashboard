import { historySteps, type HistoryStep } from '@/entities/product'
import type { LifecycleRecord } from '@/entities/types'
import { useProductHistory } from '@/shared/api/queries'
import { EmptyState, QueryState, Skeleton } from '@/shared/ui'
import { cn, formatDate } from '@/shared/lib/utils'

/**
 * «История ЖЦ»: the hose's lines in 1С's statuses register, oldest first; the
 * latest is its state now. A status the cabinet does not know yet (a repair,
 * say) shows by the name 1С gives it.
 */
export function ProductLifecycle({ productId }: { productId: string }) {
  const query = useProductHistory(productId)
  return (
    <QueryState query={query} skeleton={<Skeleton className="h-40" />}>
      {(records) =>
        records.length === 0 ? (
          <EmptyState
            inset
            title="Событий пока нет"
            description="Здесь появится история изделия из 1С: каждый статус и документ, который его записал."
          />
        ) : (
          <Timeline steps={historySteps(records)} />
        )
      }
    </QueryState>
  )
}

const DOCUMENT: Record<LifecycleRecord['document']['kind'], string> = {
  release: 'Выпуск',
  order: 'Заказ клиента',
  other: 'Документ',
}

const documentLabel = ({ kind, number }: LifecycleRecord['document']) =>
  number ? `${DOCUMENT[kind]} № ${number}` : DOCUMENT[kind]

function Timeline({ steps }: { steps: HistoryStep[] }) {
  return (
    <ol className="relative ml-1.5 border-l border-line">
      {steps.map(({ first: r, count }, i) => {
        const current = i === steps.length - 1
        const document =
          count > 1 ? `${documentLabel(r.document)} и ещё ${count - 1}` : documentLabel(r.document)
        return (
          <li key={r.id} className="relative pb-4 pl-5 last:pb-0">
            <span
              className={cn(
                'absolute top-1 -left-[5px] size-2.5 rounded-full',
                current ? 'bg-brand' : 'bg-line-strong',
              )}
            />
            <div className={cn('text-ui', current && 'font-medium')}>{r.status}</div>
            <div className="mt-0.5 text-label text-ink-muted tabular">
              {[formatDate(r.at), document, r.author].filter(Boolean).join(' · ')}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
