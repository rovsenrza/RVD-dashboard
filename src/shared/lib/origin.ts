import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * "Back" on a hose card goes to the page the user came from, not always to the
 * hose registry: a hose opened from a machine or from the replacement journal
 * returns there, with the same filters (they live in the URL). The last section
 * page is remembered per tab; opening a hose from anywhere (link, search, scan)
 * leaves it untouched.
 */
export interface Origin {
  to: string
  label: string
}

const KEY = 'rvd.origin'

const SECTIONS: [RegExp, string][] = [
  [/^\/$/, 'На главную'],
  [/^\/products\/?$/, 'К списку изделий'],
  [/^\/equipment\/[^/]+/, 'К технике'],
  [/^\/equipment\/?$/, 'К списку техники'],
  [/^\/replacements/, 'К истории замен'],
  [/^\/requests/, 'К заявкам'],
  [/^\/notifications/, 'К уведомлениям'],
  [/^\/reports/, 'К отчётам'],
  [/^\/compare/, 'К сравнению техники'],
]

/** The origin a location would leave behind, or null for pages that are not a starting point (a hose card itself). */
export function originOf(pathname: string, search = ''): Origin | null {
  const hit = SECTIONS.find(([re]) => re.test(pathname))
  return hit ? { to: pathname + search, label: hit[1] } : null
}

export function readOrigin(fallback: Origin): Origin {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Origin>
      if (typeof parsed.to === 'string' && typeof parsed.label === 'string') {
        return { to: parsed.to, label: parsed.label }
      }
    }
  } catch {
    /* storage unavailable: fall back */
  }
  return fallback
}

/** Mount once in the layout. */
export function useTrackOrigin() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    const origin = originOf(pathname, search)
    if (!origin) return
    try {
      sessionStorage.setItem(KEY, JSON.stringify(origin))
    } catch {
      /* storage unavailable: back falls back to the registry */
    }
  }, [pathname, search])
}
