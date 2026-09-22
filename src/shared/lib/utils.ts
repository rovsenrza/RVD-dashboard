import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { differenceInDays, format, parseISO } from 'date-fns'

/** The type scale from src/index.css; unregistered, `text-caption` would read as a colour. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['micro', 'caption', 'label', 'ui', 'sheet-title', 'heading', 'title', 'kpi'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns null for missing dates so callers can render <EmptyValue />. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return format(parseISO(iso), 'dd.MM.yyyy')
}

export function formatNumber(n: number) {
  return n.toLocaleString('ru-RU')
}

export function daysLeft(startIso: string | null, lifeDays: number, now = new Date()) {
  if (!startIso) return null
  return lifeDays - differenceInDays(now, parseISO(startIso))
}
