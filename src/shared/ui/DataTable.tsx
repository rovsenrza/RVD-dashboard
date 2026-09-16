import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from './Button'
import { EmptyState } from './States'

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  globalFilter?: string
  onRowClick?: (row: T) => void
  pageSize?: number
  /** Borderless variant for embedding inside a Card; hides pagination when everything fits. */
  compact?: boolean
  emptyTitle?: string
}

export function DataTable<T>({
  data,
  columns,
  globalFilter,
  onRowClick,
  pageSize = 20,
  compact = false,
  emptyTitle,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })
  const { pageIndex } = table.getState().pagination
  const total = table.getFilteredRowModel().rows.length
  const rows = table.getRowModel().rows
  const showPagination = !compact || total > pageSize

  if (!rows.length && !globalFilter) return <EmptyState title={emptyTitle} />

  return (
    <div className="space-y-3">
      <div
        className={cn('overflow-x-auto', !compact && 'rounded-xl border border-line bg-surface')}
      >
        <table className="w-full text-sm">
          <thead className={cn('text-left text-xs text-ink-muted', !compact && 'bg-surface-muted')}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className={cn(
                      'px-3 py-2 font-medium whitespace-nowrap select-none',
                      compact && 'px-0 pb-1',
                      h.column.getCanSort() && 'cursor-pointer hover:text-ink',
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === 'asc' && <ArrowUp size={12} />}
                      {h.column.getIsSorted() === 'desc' && <ArrowDown size={12} />}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={cn(
                  'border-t border-line',
                  onRowClick && 'cursor-pointer hover:bg-surface-muted',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn('px-3 py-2 whitespace-nowrap', compact && 'px-0 py-1.5')}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-ink-muted">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {showPagination && (
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>
            Показано {Math.min(pageIndex * pageSize + 1, total)}–
            {Math.min((pageIndex + 1) * pageSize, total)} из {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              icon={ChevronLeft}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Назад"
            />
            <span className="px-2 tabular-nums">
              {pageIndex + 1} / {table.getPageCount() || 1}
            </span>
            <Button
              variant="secondary"
              size="icon"
              icon={ChevronRight}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Вперёд"
            />
          </div>
        </div>
      )}
    </div>
  )
}
