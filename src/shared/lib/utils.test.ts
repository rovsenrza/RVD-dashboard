import { describe, expect, it } from 'vitest'
import { cn, daysLeft, formatDate } from './utils'

describe('utils', () => {
  it('keeps a type-scale size next to a text colour, and lets a later size win', () => {
    expect(cn('text-caption text-ink-muted')).toBe('text-caption text-ink-muted')
    expect(cn('text-label', 'text-status-replace-ink')).toBe('text-label text-status-replace-ink')
    expect(cn('text-ui', 'text-sheet-title')).toBe('text-sheet-title')
  })
  it('formats ISO dates as dd.MM.yyyy', () => {
    expect(formatDate('2025-01-25')).toBe('25.01.2025')
    expect(formatDate(null)).toBeNull()
  })
  it('computes remaining service life', () => {
    expect(daysLeft('2025-01-01', 365, new Date('2025-07-01'))).toBe(184)
    expect(daysLeft(null, 365)).toBeNull()
  })
})
