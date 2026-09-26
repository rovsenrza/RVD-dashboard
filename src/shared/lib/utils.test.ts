import { describe, expect, it } from 'vitest'
import { cn, formatDate, plural } from './utils'
import { excelDate } from './export'

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
})

describe('plural', () => {
  it('agrees the noun with the number', () => {
    const rows = (n: number) => `${n} ${plural(n, 'строка', 'строки', 'строк')}`
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111, 104].map(rows)).toEqual([
      '1 строка',
      '2 строки',
      '5 строк',
      '11 строк',
      '12 строк',
      '21 строка',
      '22 строки',
      '25 строк',
      '111 строк',
      '104 строки',
    ])
  })
})

describe('excelDate', () => {
  it('keeps the calendar day whatever the time zone', () => {
    expect(excelDate('2026-09-05').toISOString()).toBe('2026-09-05T00:00:00.000Z')
  })
})
