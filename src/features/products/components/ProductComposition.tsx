import type { CompositionLine } from '@/entities/types'
import { Card, EmptyState } from '@/shared/ui'

export function ProductComposition({ lines }: { lines: CompositionLine[] }) {
  return (
    <Card title="Состав рукава в сборе">
      {lines.length === 0 ? (
        <EmptyState
          inset
          title="Состав не указан"
          description="Состав придёт из каталожного номера в 1С."
        />
      ) : (
        <ul className="divide-y divide-line text-[13.5px]">
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
    </Card>
  )
}
