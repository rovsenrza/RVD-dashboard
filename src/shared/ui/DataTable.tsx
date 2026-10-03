import {
  Fragment,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type RowData,
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
import { Checkbox } from './Checkbox'
import { Input } from './Input'
import { Menu } from './Menu'
import { EmptyState } from './States'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * Role of the column in the phone row card. Unset: a «label  value» line.
     * `title` leads the card (default: the first visible column), `aside` sits
     * right of it (a status, a date), `full` is a label-less full-width line
     * (a status bar), `hide` is left off phones.
     */
    mobile?: 'title' | 'aside' | 'full' | 'hide'
  }
}

/** What a page may ask of its table: the rows as the user sees them, across all pages. */
export interface DataTableHandle<T> {
  /** Filtered by the search and sorted by the user's column, before pagination. */
  visibleRows: () => T[]
}

/**
 * Rows the user may tick for a bulk action. The box rides in the key column's
 * cell (so pinning and the column chooser are untouched) and leads the phone
 * row card; ticking never opens the row.
 */
export interface TableSelection<T> {
  rowId: (row: T) => string
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  /** Rows that cannot take part get no box */
  canSelect?: (row: T) => boolean
  /** The box's accessible name, e.g. «Выбрать EHS 48703» */
  label: (row: T) => string
}

/** Keeps a tick from also clicking (or Enter-opening) the row around it. */
const stop = {
  onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onKeyDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
}

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
  /** For exports: «what I see» is the search and sort applied here, not the page's data. */
  handle?: Ref<DataTableHandle<T>>
  /** Tick boxes for a bulk action; see TableSelection. */
  selection?: TableSelection<T>
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
  handle,
  selection,
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
  useImperativeHandle(
    handle,
    () => ({ visibleRows: () => table.getPrePaginationRowModel().rows.map((r) => r.original) }),
    [table],
  )
  const { pageIndex, pageSize: size } = table.getState().pagination
  const total = table.getFilteredRowModel().rows.length
  const rows = table.getRowModel().rows
  const pageCount = table.getPageCount() || 1
  const showPagination = total > 0 && (!embedded || total > size)
  const overflow = useOverflowX()

  // «All on this page»: the header box ticks or clears every selectable row in view.
  const pageIds = selection
    ? rows
        .filter((r) => selection.canSelect?.(r.original) ?? true)
        .map((r) => selection.rowId(r.original))
    : []
  const pickedOnPage = pageIds.filter((id) => selection?.selected.has(id)).length
  const toggle = (id: string, on: boolean) => {
    if (!selection) return
    const next = new Set(selection.selected)
    if (on) next.add(id)
    else next.delete(id)
    selection.onChange(next)
  }
  const togglePage = (on: boolean) => {
    if (!selection) return
    const next = new Set(selection.selected)
    for (const id of pageIds) {
      if (on) next.add(id)
      else next.delete(id)
    }
    selection.onChange(next)
  }
  const rowBox = (row: T) =>
    selection && (selection.canSelect?.(row) ?? true) ? (
      <span {...stop} className="-my-2 -ml-2 inline-flex p-2">
        <Checkbox
          label={selection.label(row)}
          hideLabel
          checked={selection.selected.has(selection.rowId(row))}
          onChange={(e) => toggle(selection.rowId(row), e.target.checked)}
        />
      </span>
    ) : null

  // With filters on screen an empty result keeps the table, so the filters stay reachable.
  if (!data.length && !toolbar && !search) return <EmptyState title={emptyTitle} inset={embedded} />

  // Embedded: flush with the host sheet at both ends, a gutter between columns.
  const cellX = embedded ? 'px-3 first:pl-0 last:pr-0' : 'px-5'
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
                <div className="text-caption font-medium tracking-wide text-ink-muted uppercase">
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

      <RowCards
        rows={rows}
        onRowClick={onRowClick}
        box={selection && rowBox}
        className={embedded ? 'px-0' : 'px-5'}
      />
      <div className="relative max-sm:hidden">
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
                          'py-2.5 text-left text-caption font-medium tracking-wide whitespace-nowrap text-ink-muted uppercase select-none',
                          cellX,
                          canSort && 'cursor-pointer hover:text-ink',
                          sticky && i === 0 && 'sticky left-0 z-10 bg-sheet',
                        )}
                      >
                        <span className="inline-flex items-center gap-1">
                          {selection && i === 0 && pageIds.length > 0 && (
                            <span {...stop} className="-my-2 mr-1.5 -ml-2 inline-flex p-2">
                              <Checkbox
                                label="Выбрать все на странице"
                                hideLabel
                                checked={pickedOnPage === pageIds.length}
                                indeterminate={pickedOnPage > 0 && pickedOnPage < pageIds.length}
                                onChange={(e) => togglePage(e.target.checked)}
                              />
                            </span>
                          )}
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
              {rows.map((row) => {
                const ticked = !!selection?.selected.has(selection.rowId(row.original))
                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    aria-selected={selection ? ticked : undefined}
                    className={cn(
                      'group border-b border-line last:border-b-0',
                      onRowClick &&
                        'cursor-pointer transition-colors duration-100 hover:bg-row-hover',
                      ticked && 'bg-row-hover',
                    )}
                  >
                    {row.getVisibleCells().map((cell, i) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'py-3 whitespace-nowrap tabular',
                          cellX,
                          sticky &&
                            i === 0 &&
                            cn(
                              'sticky left-0 z-10 bg-sheet group-hover:bg-row-hover',
                              ticked && 'bg-row-hover',
                            ),
                        )}
                      >
                        {i === 0 && selection ? (
                          <span className="inline-flex items-center gap-1.5">
                            {rowBox(row.original)}
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </span>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
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
            'flex flex-wrap items-center justify-between gap-3 text-label text-ink-muted',
            embedded ? 'pt-3' : 'px-5 py-3',
          )}
        >
          <span className="tabular">
            Показано {Math.min(pageIndex * size + 1, total)}–
            {Math.min((pageIndex + 1) * size, total)} из {total}
          </span>
          <div className="flex items-center gap-3">
            {tools && (
              <div className="max-sm:hidden">
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
              </div>
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
              <span className="max-sm:hidden">
                <PageNumbers
                  current={pageIndex}
                  count={pageCount}
                  onPick={(i) => table.setPageIndex(i)}
                />
              </span>
              {/* Phones: position only; paging by number is a desktop habit, search is faster. */}
              <span className="px-1 text-ink-secondary tabular sm:hidden">
                {pageIndex + 1} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                icon={ChevronRight}
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Следующая страница"
              />
            </div>
            {pageCount > 5 && (
              <span className="max-sm:hidden">
                <PageJump count={pageCount} onPick={(i) => table.setPageIndex(i)} />
              </span>
            )}
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
  }, [])
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
              p === current
                ? 'bg-brand font-medium text-on-brand'
                : 'text-ink-secondary hover:bg-wash',
            )}
          >
            {p + 1}
          </button>
        ),
      )}
    </span>
  )
}

/** «Стр. [№]» + Enter jumps straight to a page; numbers past either end land on it. */
function PageJump({ count, onPick }: { count: number; onPick: (i: number) => void }) {
  const [text, setText] = useState('')
  return (
    <label className="flex items-center gap-1.5">
      <span aria-hidden>Стр.</span>
      <Input
        inputMode="numeric"
        aria-label={`Перейти на страницу, всего ${count}`}
        placeholder="№"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 5))}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !text) return
          onPick(Math.min(Math.max(Number(text), 1), count) - 1)
          setText('')
        }}
        className="h-8 w-14 px-2 text-center tabular"
      />
    </label>
  )
}

type AnyCell = Cell<never, unknown>

const renderCell = (c: AnyCell) => flexRender(c.column.columnDef.cell, c.getContext())
const headerText = (c: AnyCell) =>
  typeof c.column.columnDef.header === 'string' ? c.column.columnDef.header : c.column.id

/**
 * Phones: each row becomes a block inside the same sheet — the key value and
 * its status on the first line, the other visible columns as «label  value»
 * lines under it. Hairlines between rows, never a card per row.
 */
function RowCards<T>({
  rows,
  onRowClick,
  box,
  className,
}: {
  rows: { id: string; original: T; getVisibleCells: () => Cell<T, unknown>[] }[]
  onRowClick?: (row: T) => void
  /** The tick box that leads the card when the table selects */
  box?: (row: T) => ReactNode
  className: string
}) {
  if (!rows.length)
    return (
      <p className="py-10 text-center text-ink-muted sm:hidden">По запросу ничего не найдено</p>
    )
  return (
    <ul className="divide-y divide-line border-t border-line sm:hidden">
      {rows.map((row) => {
        const cells = row.getVisibleCells() as unknown as AnyCell[]
        const role = (c: AnyCell) => c.column.columnDef.meta?.mobile
        const shown = cells.filter((c) => role(c) !== 'hide')
        const title = shown.find((c) => role(c) === 'title') ?? shown[0]
        const aside = shown.filter((c) => c !== title && role(c) === 'aside')
        const full = shown.filter((c) => c !== title && role(c) === 'full')
        const lines = shown.filter((c) => c !== title && !role(c))
        const open = onRowClick && (() => onRowClick(row.original))
        return (
          <li
            key={row.id}
            role={open ? 'link' : undefined}
            tabIndex={open ? 0 : undefined}
            onClick={open}
            onKeyDown={(e) => open && e.key === 'Enter' && open()}
            className={cn(
              'py-3.5',
              className,
              open && 'cursor-pointer transition-colors duration-100 active:bg-row-hover',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-1.5 text-sm">
                {box?.(row.original)}
                {title && renderCell(title)}
              </div>
              {aside.length > 0 && (
                <div className="flex shrink-0 items-center gap-2 text-label">
                  {aside.map((c) => (
                    <Fragment key={c.id}>{renderCell(c)}</Fragment>
                  ))}
                </div>
              )}
            </div>
            {lines.length > 0 && (
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-label">
                {lines.map((c) => (
                  <Fragment key={c.id}>
                    <dt className="text-ink-muted">{headerText(c)}</dt>
                    <dd className="min-w-0 truncate text-ink-secondary tabular">{renderCell(c)}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
            {full.map((c) => (
              <div key={c.id} className="mt-2.5">
                {renderCell(c)}
              </div>
            ))}
          </li>
        )
      })}
    </ul>
  )
}
