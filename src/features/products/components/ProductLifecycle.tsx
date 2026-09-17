import type { ReleaseDocument } from '@/entities/types'
import { LIFECYCLE_LABEL } from '@/entities/product'
import { useProductDocuments } from '@/shared/api/queries'
import { Card, EmptyState, QueryState, Skeleton } from '@/shared/ui'
import { cn, formatDate } from '@/shared/lib/utils'

export function ProductLifecycle({ productId }: { productId: string }) {
  const query = useProductDocuments(productId)
  return (
    <Card title="Жизненный цикл">
      <QueryState query={query} skeleton={<Skeleton className="h-40" />}>
        {(docs) =>
          docs.length === 0 ? (
            <EmptyState
              inset
              title="Событий пока нет"
              description="Здесь появятся документы выпуска этого изделия из 1С."
            />
          ) : (
            <Timeline docs={docs} />
          )
        }
      </QueryState>
    </Card>
  )
}

function Timeline({ docs }: { docs: ReleaseDocument[] }) {
  return (
    <ol className="relative ml-1.5 border-l border-line">
      {docs.map((doc, i) => {
        const current = i === docs.length - 1
        return (
          <li key={doc.id} className="relative pb-4 pl-5 last:pb-0">
            <span
              className={cn(
                'absolute -left-[5px] top-1 size-2.5 rounded-full',
                current ? 'bg-brand' : 'bg-line-strong',
              )}
            />
            <div className={cn('text-[13.5px]', current && 'font-medium')}>
              {LIFECYCLE_LABEL[doc.lifecycle]}
            </div>
            <div className="tabular mt-0.5 text-[12.5px] text-ink-muted">
              {formatDate(doc.date)} · {doc.number} · {doc.author}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
