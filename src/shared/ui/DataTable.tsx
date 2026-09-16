import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from './Button'
import { Menu } from './Menu'
import { EmptyState } from './States'

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  globalFilter?: string
  onRowClick?: (row: T) => void
  pageSize?: number
  /** Rendered inside another sheet: no own sheet, tighter cells, pagination only when needed. */
  embedded?: boolean
  emptyTitle?: string
  /** Toolbar rendered above the header row (tabs, chips). */
  toolbar?: ReactNode
  /** Search control: right of the toolbar on wide screens, its own full-width row on narrow ones. */
  search?: ReactNode
  /** Keep the first column visible while the table scrolls horizontally. */
  stickyFirstColumn?: boolean
  /** Show the «Колонки» chooser and «на странице» selector (reference registry tools). */
  tools?: boolean
  /** Columns hidden by default (ids); the user can re-enable them via the chooser. */
  hiddenByDefault?: string[]
}

const PAGE_SIZES = [10, 20, 50]

export function DataTable<T>({
  data,
  columns,
  globalFilter,
  onRowClick,
  pageSize = 20,
  embedded = false,
  emptyTitle,
  toolbar,
  search,
  stickyFirstColumn = false,
  tools = false,
  hiddenByDefault = [],
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(hiddenByDefault.map((id) => [id, false])),
  )
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })
  const { pageIndex, pageSize: size } = table.getState().pagination
  const total = table.getFilteredRowModel().rows.length
  const rows = table.getRowModel().rows
  const pageCount = table.getPageCount() || 1
  const showPagination = !embedded || total > size
  const overflow = useOverflowX()

  if (!data.length) return <EmptyState title={emptyTitle} inset={embedded} />

  const cellX = embedded ? 'px-0 first:pl-0 last:pr-0' : 'px-5'
  // Pin the key column only once the table actually overflows; at rest it is an ordinary cell.
  const sticky = stickyFirstColumn && !embedded && overflow.scrollable

  return (
    <div className={cn(!embedded && 'sheet')}>
      {(toolbar || search || tools) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-5 pt-4 pb-3">
          <div className="flex min-w-0 flex-1 items-center gap-4">{toolbar}</div>
          {search && <div className="order-last w-full md:order-none md:w-80">{search}</div>}
          {tools && (
            <Menu
              trigger={() => (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Columns3}
                    className="hidden md:inline-flex"
                  >
                    Колонки
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    icon={Columns3}
                    className="md:hidden"
                    aria-label="Колонки"
                  />
                </>
              )}
              header={
                <div className="text-[12px] font-medium tracking-wide text-ink-muted uppercase">
                  Показывать колонки
                </div>
              }
              items={table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => ({
                  label: String(c.columnDef.header ?? c.id),
                  icon: c.getIsVisible() ? Check : undefined,
                  onSelect: () => c.toggleVisibility(),
                }))}
            />
          )}
        </div>
      )}

      <div className="relative">
        <div ref={overflow.ref} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-line">
                  {hg.headers.map((h, i) => {
                    const sorted = h.column.getIsSorted()
                    const canSort = h.column.getCanSort()
                    return (
                      <th
                        key={h.id}
                        onClick={h.column.getToggleSortingHandler()}
                        aria-sort={
                          sorted === 'asc'
                            ? 'ascending'
                            : sorted === 'desc'
                              ? 'descending'
                              : undefined
                        }
                        className={cn(
                          'py-2.5 text-left text-[12px] font-medium tracking-wide whitespace-nowrap text-ink-muted uppercase select-none',
                          cellX,
                          canSort && 'cursor-pointer hover:text-ink',
                          sticky && i === 0 && 'sticky left-0 z-10 bg-sheet',
                        )}
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {canSort &&
                            (sorted === 'asc' ? (
                              <ArrowUp size={12} className="text-brand-dark" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown size={12} className="text-brand-dark" />
                            ) : (
                              <ChevronsUpDown size={12} className="opacity-40" />
                            ))}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    'group border-b border-line last:border-b-0',
                    onRowClick &&
                      'cursor-pointer transition-colors duration-100 hover:bg-brand-soft/40',
                  )}
                >
                  {row.getVisibleCells().map((cell, i) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'py-3 whitespace-nowrap tabular',
                        cellX,
                        sticky && i === 0 && 'sticky left-0 z-10 bg-sheet group-hover:bg-[#fffaf0]',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-10 text-center text-ink-muted">
                    По запросу ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Scroll cue: fades the clipped edge so a cut column never looks like the last one. */}
        {overflow.scrollable && !overflow.atEnd && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-sheet via-sheet/80 to-transparent"
            aria-hidden
          >
            <ChevronRight
              size={16}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-ink-muted"
            />
          </div>
        )}
      </div>

      {showPagination && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-muted',
            embedded ? 'pt-3' : 'px-5 py-3',
          )}
        >
          <span className="tabular">
            Показано {Math.min(pageIndex * size + 1, total)}–
            {Math.min((pageIndex + 1) * size, total)} из {total}
          </span>
          <div className="flex items-center gap-3">
            {tools && (
              <Menu
                trigger={() => (
                  <Button variant="ghost" size="sm" className="text-ink-muted">
                    {size} на странице
                  </Button>
                )}
                items={PAGE_SIZES.map((n) => ({
                  label: `${n} на странице`,
                  icon: n === size ? Check : undefined,
                  onSelect: () => table.setPageSize(n),
                }))}
              />
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                icon={ChevronLeft}
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Предыдущая страница"
              />
              <PageNumbers
                current={pageIndex}
                count={pageCount}
                onPick={(i) => table.setPageIndex(i)}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                icon={ChevronRight}
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Следующая страница"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Tracks whether a scroll container overflows horizontally and whether it is scrolled to the end. */
function useOverflowX() {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState({ scrollable: false, atEnd: true })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () =>
      setState({
        scrollable: el.scrollWidth > el.clientWidth + 1,
        atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
      })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
    }
  })
  return { ref, ...state }
}

/** 1 2 3 … N with the current page in amber, as in the reference. */
function PageNumbers({
  current,
  count,
  onPick,
}: {
  current: number
  count: number
  onPick: (i: number) => void
}) {
  const pages = new Set<number>([0, count - 1, current - 1, current, current + 1])
  const list = [...pages].filter((p) => p >= 0 && p < count).sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  list.forEach((p, i) => {
    if (i && p - list[i - 1] > 1) out.push('gap')
    out.push(p)
  })
  return (
    <span className="flex items-center gap-0.5">
      {out.map((p, i) =>
        p === 'gap' ? (
          <span key={`g${i}`} className="px-1 text-ink-faint">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            aria-current={p === current ? 'page' : undefined}
            className={cn(
              'h-8 min-w-8 rounded-lg px-1.5 tabular transition-colors duration-100',
              p === current ? 'bg-brand font-medium text-ink' : 'text-ink-secondary hover:bg-field',
            )}
          >
            {p + 1}
          </button>
        ),
      )}
    </span>
  )
}
