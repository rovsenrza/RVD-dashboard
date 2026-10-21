import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

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

/** dd.MM.yyyy HH:mm in local time, for moments rather than days (the action log). */
export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'dd.MM.yyyy HH:mm')
}

export function formatNumber(n: number) {
  return n.toLocaleString('ru-RU')
}

/** Russian noun agreement: plural(21, 'строка', 'строки', 'строк') → «строка». */
export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
