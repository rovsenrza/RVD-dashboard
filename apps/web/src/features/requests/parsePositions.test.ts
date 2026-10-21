import { describe, expect, it } from 'vitest'
import { parsePositions } from './parsePositions'

describe('parsePositions', () => {
  it('reads one number per line, quantity one by default', () => {
    expect(parsePositions('07098-010A9\n48700-0021')).toEqual([
      { catalogNumber: '07098-010A9', quantity: 1 },
      { catalogNumber: '48700-0021', quantity: 1 },
    ])
  })

  it('does not mistake the digits ending a number for a quantity', () => {
    expect(parsePositions('07098-010A9')).toEqual([{ catalogNumber: '07098-010A9', quantity: 1 }])
  })

  it('accepts the usual separators before a quantity', () => {
    const lines = ['A-1 5', 'B-2; 6', 'C-3\t7', 'D-4 x8', 'E-5×9', 'F-6 * 10']
    expect(parsePositions(lines.join('\n')).map((p) => p.quantity)).toEqual([5, 6, 7, 8, 9, 10])
    expect(parsePositions('A-1 5')[0].catalogNumber).toBe('A-1')
  })

  it('sums repeats, skips blanks, keeps order and caps the quantity', () => {
    expect(parsePositions('A-1 2\n\n  \nB-2\na-1 3\nC-3 500')).toEqual([
      { catalogNumber: 'A-1', quantity: 5 },
      { catalogNumber: 'B-2', quantity: 1 },
      { catalogNumber: 'C-3', quantity: 99 },
    ])
  })
})
