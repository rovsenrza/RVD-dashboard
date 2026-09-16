import type { ReactNode } from 'react'

/** Single muted renderer for "no value" cells; keeps every dash one weight and colour. */
export function EmptyValue() {
  return (
    <span className="text-ink-faint" aria-label="нет данных">
      —
    </span>
  )
}

export function valueOr(v: ReactNode | null | undefined): ReactNode {
  return v === null || v === undefined || v === '' ? <EmptyValue /> : v
}
