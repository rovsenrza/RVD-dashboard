import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { differenceInDays, format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return format(parseISO(iso), 'dd.MM.yyyy')
}

export function formatNumber(n: number) {
  return n.toLocaleString('ru-RU')
}

export function daysLeft(startIso: string | null, lifeDays: number, now = new Date()) {
  if (!startIso) return null
  return lifeDays - differenceInDays(now, parseISO(startIso))
}
