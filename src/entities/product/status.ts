import type { ProductLifecycle, ProductStatus } from '@/entities/types'

export const STATUS_ORDER: ProductStatus[] = ['ok', 'warn', 'replace', 'no_warranty']

/** Порядок этапов ЖЦ в 1С — по нему строится история на карточке изделия. */
export const LIFECYCLE_ORDER: ProductLifecycle[] = [
  'manufacturing',
  'in_stock',
  'shipped',
  'in_operation',
  'needs_replacement',
  'written_off',
]

export const LIFECYCLE_LABEL: Record<ProductLifecycle, string> = {
  manufacturing: 'Изготавливается',
  in_stock: 'На складе',
  shipped: 'Отгружен',
  in_operation: 'В эксплуатации',
  needs_replacement: 'Требует замены',
  written_off: 'Списан',
}

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

/** Tailwind text classes (AA on white) for counts and labels tinted by status. */
export const STATUS_TEXT_CLASS: Record<ProductStatus, string> = {
  ok: 'text-status-ok-ink',
  warn: 'text-status-warn-ink',
  replace: 'text-status-replace-ink',
  no_warranty: 'text-status-none-ink',
}

/** CSS custom property per status — for charts and inline styles. */
export const STATUS_COLOR: Record<ProductStatus, string> = {
  ok: 'var(--color-status-ok)',
  warn: 'var(--color-status-warn)',
  replace: 'var(--color-status-replace)',
  no_warranty: 'var(--color-status-none)',
}
