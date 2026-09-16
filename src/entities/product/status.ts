import type { ProductStatus } from '@/entities/types'

export const STATUS_ORDER: ProductStatus[] = ['ok', 'warn', 'replace', 'no_warranty']

export const STATUS_LABEL: Record<ProductStatus, string> = {
  ok: 'Норма',
  warn: 'Внимание',
  replace: 'Требуется замена',
  no_warranty: 'Не на гарантии',
}

/** Maps domain status → Badge tone (shared/ui vocabulary). */
export const STATUS_TONE = {
  ok: 'ok',
  warn: 'warn',
  replace: 'replace',
  no_warranty: 'none',
} as const satisfies Record<ProductStatus, string>

/** CSS custom property per status — for charts and inline styles. */
export const STATUS_COLOR: Record<ProductStatus, string> = {
  ok: 'var(--color-status-ok)',
  warn: 'var(--color-status-warn)',
  replace: 'var(--color-status-replace)',
  no_warranty: 'var(--color-status-none)',
}
