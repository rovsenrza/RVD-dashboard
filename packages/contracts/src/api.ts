import { z } from 'zod'

/** A page of a list; `total` counts every match, not just this page. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export const PRODUCT_SORT_KEYS = [
  'serialNumber',
  'type',
  'catalogNumber',
  'shippedAt',
  'installedAt',
  'plannedAt',
  'status',
  'lifecycle',
] as const

/** `GET /products` — the filters of the registry, all optional, all applied on the server. */
export const ProductListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  sort: z.enum(PRODUCT_SORT_KEYS).default('serialNumber'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  /** Free text over serial, catalogue and nomenclature numbers and the name */
  q: z.string().trim().max(100).optional(),
  status: z.enum(['ok', 'warn', 'replace', 'no_warranty']).optional(),
  lifecycle: z
    .enum([
      'manufacturing',
      'in_stock',
      'shipped',
      'in_operation',
      'needs_replacement',
      'written_off',
    ])
    .optional(),
  equipment: z.string().min(1).optional(),
  catalog: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  /** The customer; until auth exists the caller names it, afterwards the token decides */
  client: z.string().min(1).optional(),
  installed: z.enum(['1', '0']).optional(),
  /** `1` = the archive (written off), `0` = everything else */
  archive: z.enum(['1', '0']).optional(),
})

export type ProductListQuery = z.infer<typeof ProductListQuery>
