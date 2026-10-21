import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export interface SimpleColumn {
  key: string
  header: string
  align?: 'left' | 'right'
}

/**
 * A plain table for documents and print: no sorting, paging or hover. The
 * header repeats on every printed page, and a row never splits across pages.
 */
export function SimpleTable({
  columns,
  rows,
  footer,
  className,
}: {
  columns: SimpleColumn[]
  rows: Record<string, ReactNode>[]
  /** A bold closing row, e.g. «Итого» */
  footer?: Record<string, ReactNode> | null
  className?: string
}) {
  const cell = (c: SimpleColumn) =>
    cn('px-2 py-1.5 align-top first:pl-0 last:pr-0', c.align === 'right' && 'text-right tabular')
  return (
    <table className={cn('w-full border-collapse text-caption', className)}>
      <thead className="table-header-group">
        <tr className="border-b border-line-strong">
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={cn(
                cell(c),
                'text-left align-bottom text-micro font-medium tracking-wide text-ink-muted uppercase',
                c.align === 'right' && 'text-right',
              )}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="break-inside-avoid border-b border-line">
            {columns.map((c) => (
              <td key={c.key} className={cell(c)}>
                {r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot className="table-row-group">
          <tr className="border-t border-line-strong font-semibold">
            {columns.map((c) => (
              <td key={c.key} className={cell(c)}>
                {footer[c.key]}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  )
}
