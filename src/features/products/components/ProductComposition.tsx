import { useState } from 'react'
import type { CompositionLine } from '@/entities/types'
import { useProductDocumentation } from '@/shared/api/queries'
import { Card, EmptyState, QueryState, Skeleton } from '@/shared/ui'
import { AttachmentViewer } from '@/features/attachments/AttachmentViewer'
import { DocumentRow } from '@/features/attachments/DocumentRow'

const Heading = ({ children }: { children: string }) => (
  <h3 className="mb-1.5 text-caption font-medium tracking-wide text-ink-muted uppercase">
    {children}
  </h3>
)

/** The assembly as 1С specifies it, and the paperwork that comes with its catalogue number. */
export function ProductComposition({
  productId,
  lines,
}: {
  productId: string
  lines: CompositionLine[]
}) {
  return (
    <Card title="Состав рукава в сборе">
      {lines.length === 0 ? (
        <EmptyState
          inset
          title="Состав не указан"
          description="Состав придёт из каталожного номера в 1С."
        />
      ) : (
        <ul className="divide-y divide-line text-ui">
          {lines.map((line) => (
            <li
              key={line.componentId}
              className="flex items-center gap-4 py-2 first:pt-0 last:pb-0"
            >
              <span className="min-w-0 flex-1 truncate" title={line.name}>
                {line.name}
              </span>
              <span className="tabular shrink-0 text-ink-muted">× {line.quantity}</span>
            </li>
          ))}
        </ul>
      )}
      <Documentation productId={productId} />
    </Card>
  )
}

function Documentation({ productId }: { productId: string }) {
  const query = useProductDocumentation(productId)
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="mt-5 border-t border-line pt-4">
      <Heading>Техническая документация · из 1С</Heading>
      <QueryState query={query} skeleton={<Skeleton className="h-24 w-full" />}>
        {(docs) =>
          docs.length ? (
            <ul className="-mx-2 grid">
              {docs.map((d, i) => (
                <li key={d.id}>
                  <DocumentRow file={d} onOpen={() => setOpen(i)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ui text-ink-muted">
              Для этого каталожного номера в 1С документов нет.
            </p>
          )
        }
      </QueryState>
      {open !== null && query.data && (
        <AttachmentViewer files={query.data} start={open} onClose={() => setOpen(null)} />
      )}
    </section>
  )
}
