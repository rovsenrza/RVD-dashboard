// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { FILTER_BUDGET, keyFilters } from './sources.ts'

const key = (i: number) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
const keys = Array.from({ length: 100 }, (_, i) => key(i))

describe('filters of keys for 1С', () => {
  it('keep every encoded filter inside the URL, a Cyrillic field too', () => {
    for (const field of ['Ref_Key', 'Изделие_Key']) {
      const filters = keyFilters(field, keys)
      for (const f of filters)
        expect(encodeURIComponent(f).length).toBeLessThanOrEqual(FILTER_BUDGET)
      // Every key once, in order.
      expect(filters.join(' or ').match(/guid'[^']+'/g)).toEqual(keys.map((k) => `guid'${k}'`))
    }
    // The Cyrillic name costs more, so its batches are smaller.
    expect(keyFilters('Изделие_Key', keys).length).toBeGreaterThan(
      keyFilters('Ref_Key', keys).length,
    )
  })

  it('make one filter for a few keys and none for no keys', () => {
    expect(keyFilters('Ref_Key', [key(1), key(2)])).toEqual([
      `Ref_Key eq guid'${key(1)}' or Ref_Key eq guid'${key(2)}'`,
    ])
    expect(keyFilters('Ref_Key', [])).toEqual([])
  })
})
