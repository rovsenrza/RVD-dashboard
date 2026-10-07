import { describe, expect, it } from 'vitest'
import type { RequestPosition, ServiceRequest } from '@/entities/types'
import { concernsProduct } from './product'

const line = (productId: string | null): RequestPosition => ({
  productId,
  catalogNumberId: null,
  catalogNumber: productId ? null : '02753-00613',
  equipmentId: null,
  quantity: 1,
})
const request = (productId: string | null, positions: RequestPosition[]) =>
  ({ productId, positions }) as ServiceRequest

describe('a request on a hose card', () => {
  it('belongs to the hose it replaces or repairs, on any line', () => {
    expect(concernsProduct(request('p1', [line('p1')]), 'p1')).toBe(true)
    expect(concernsProduct(request(null, [line('p2'), line('p1')]), 'p1')).toBe(true)
  })

  it('not to another hose, nor a manufacture order by catalogue number', () => {
    expect(concernsProduct(request('p2', [line('p2')]), 'p1')).toBe(false)
    expect(concernsProduct(request(null, [line(null)]), 'p1')).toBe(false)
  })
})
