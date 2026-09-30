import { ZERO_GUID } from '../raw.ts'

/** 1С pads text with spaces and uses no-break spaces in names. */
export function cleanText(value: string | null | undefined): string {
  return (value ?? '').replaceAll(' ', ' ').replace(/\s+/g, ' ').trim()
}

export const orNull = (value: string | null | undefined) => cleanText(value) || null

/** A whole number from 1С text such as "365" or "4  "; blank or junk is 0. */
export function wholeNumber(value: string | number | null | undefined): number {
  const n = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** `yyyy-MM-dd` from a 1С date-time; the empty date (0001-01-01) is null. */
export function dateOnly(value: string | null | undefined): string | null {
  if (!value || value.startsWith('0001-01-01')) return null
  return value.slice(0, 10)
}

export const isRef = (key: string | null | undefined): key is string => !!key && key !== ZERO_GUID

/** The number hoses are known by: the 1С code without its padding zeros ("000003844" → "3844"). */
export function displayCode(code: string): string {
  const trimmed = cleanText(code)
  return trimmed.replace(/^0+(?=\d)/, '')
}

export function byKey<T>(rows: T[], key: (row: T) => string): Map<string, T> {
  return new Map(rows.map((row) => [key(row), row]))
}
