import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { differenceInDays, format, parseISO } from 'date-fns'
import type { ProductStatus } from '@/entities/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return format(parseISO(iso), 'dd.MM.yyyy')
}

export function daysLeft(startIso: string | null, lifeDays: number, now = new Date()) {
  if (!startIso) return null
  return lifeDays - differenceInDays(now, parseISO(startIso))
}

export const STATUS_LABEL: Record<ProductStatus, string> = {
  ok: 'Норма',
  warn: 'Внимание',
  replace: 'Требуется замена',
  no_warranty: 'Не на гарантии',
}

export const STATUS_CLASS: Record<ProductStatus, string> = {
  ok: 'bg-status-ok/15 text-status-ok',
  warn: 'bg-status-warn/15 text-status-warn',
  replace: 'bg-status-replace/15 text-status-replace',
  no_warranty: 'bg-status-none/15 text-status-none',
}

export const STATUS_BAR_CLASS: Record<ProductStatus, string> = {
  ok: 'bg-status-ok',
  warn: 'bg-status-warn',
  replace: 'bg-status-replace',
  no_warranty: 'bg-status-none',
}
