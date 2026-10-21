import type { ServiceRequest } from '@/entities/types'

/** A request names a hose as the one it replaces or repairs; «Изготовление» names none. */
export const concernsProduct = (r: ServiceRequest, productId: string) =>
  r.productId === productId || r.positions.some((p) => p.productId === productId)
