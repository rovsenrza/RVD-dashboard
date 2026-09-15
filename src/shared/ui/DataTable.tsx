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

export function DataTable<T>({
  data,
  columns,
  globalFilter,
  onRowClick,
  pageSize = 20,
}: {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  globalFilter?: string
  onRowClick?: (row: T) => void
  pageSize?: number
}) {
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

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs text-ink-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className={cn(
                      'px-3 py-2 font-medium whitespace-nowrap select-none',
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
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={cn(
                  'border-t border-line',
                  onRowClick && 'cursor-pointer hover:bg-surface-muted',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!table.getRowModel().rows.length && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-ink-muted">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>
          Показано {Math.min(pageIndex * pageSize + 1, total)}–
          {Math.min((pageIndex + 1) * pageSize, total)} из {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="rounded border border-line p-1 disabled:opacity-40"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Назад"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2">
            {pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <button
            className="rounded border border-line p-1 disabled:opacity-40"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Вперёд"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
