import { describe, expect, it } from 'vitest'
import { daysLeft, formatDate } from './utils'

describe('utils', () => {
  it('formats ISO dates as dd.MM.yyyy', () => {
    expect(formatDate('2025-01-25')).toBe('25.01.2025')
    expect(formatDate(null)).toBeNull()
  })
  it('computes remaining service life', () => {
    expect(daysLeft('2025-01-01', 365, new Date('2025-07-01'))).toBe(184)
    expect(daysLeft(null, 365)).toBeNull()
  })
})
