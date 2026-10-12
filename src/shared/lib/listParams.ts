import type { SortingState } from '@tanstack/react-table'
import { useSearchParams } from 'react-router-dom'

/** The address keys a list keeps its place in; filters of a page may use any others. */
export const LIST_KEYS = ['page', 'size', 'sort', 'q', 'tab'] as const

/**
 * A list's page, page size, sort, search and tab, kept in the address. Opening
 * a row and coming back (the back link returns to the address it left, see
 * `origin.ts`) lands on the same page of the same list (customer, 2026-10-11).
 * Anything that changes what the list holds sends it back to page one.
 */
export function useListParams(defaultSize = 10) {
  const [params, setParams] = useSearchParams()
  const update = (patch: Record<string, string | null>) =>
    setParams(
      (before) => {
        const next = new URLSearchParams(before)
        for (const [key, value] of Object.entries(patch))
          if (value) next.set(key, value)
          else next.delete(key)
        return next
      },
      { replace: true },
    )

  const sort = params.get('sort')
  const sorting: SortingState = sort
    ? [{ id: sort.replace(/^-/, ''), desc: sort.startsWith('-') }]
    : []
  const size = Number(params.get('size'))

  return {
    pageIndex: Math.max(1, Math.floor(Number(params.get('page'))) || 1) - 1,
    pageSize: size > 0 ? size : defaultSize,
    sorting,
    q: params.get('q') ?? '',
    tab: params.get('tab'),
    setPage: (index: number) => update({ page: index > 0 ? String(index + 1) : null }),
    setPageSize: (next: number) =>
      update({ size: next === defaultSize ? null : String(next), page: null }),
    setSorting: (next: SortingState) =>
      update({
        sort: next[0] ? `${next[0].desc ? '-' : ''}${next[0].id}` : null,
        page: null,
      }),
    setQ: (next: string) => update({ q: next || null, page: null }),
    setTab: (next: string | null) => update({ tab: next, page: null }),
  }
}
