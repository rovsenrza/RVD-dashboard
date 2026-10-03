import { z } from 'zod'
import type { Product } from './types'

/** A page of a list; `total` counts every match, not just this page. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

/** A page of the registry, with the size of both its tabs under the same filters and search. */
export interface ProductPage extends Paginated<Product> {
  counts: { active: number; archive: number }
}

/** Every column of the registry sorts on the server, plus the planned replacement date. */
export const PRODUCT_SORT_KEYS = [
  'serialNumber',
  'clientNumber',
  'type',
  'catalogNumber',
  'manufacturer',
  'shippedAt',
  'installedAt',
  'plannedAt',
  'status',
  'lifecycle',
  'installPlace',
] as const

export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number]

/** `GET /products` — the filters of the registry, all optional, all applied on the server. */
export const ProductListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  sort: z.enum(PRODUCT_SORT_KEYS).default('serialNumber'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  /** Free text over the hose's numbers (serial, client's, catalogue, nomenclature), its name, machine and place */
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
