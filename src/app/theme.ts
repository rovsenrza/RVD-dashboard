import { useCallback, useState } from 'react'

/**
 * Colour theme. «Системная» follows the OS through prefers-color-scheme in
 * index.css; an explicit choice pins `data-theme` on <html>. index.html applies
 * the stored choice before first paint, so there is no light flash in dark.
 */
export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'rvd.theme'

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function applyThemePreference(pref: ThemePreference) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // Storage blocked (private window): the choice holds until reload.
  }
}

export function useThemePreference() {
  const [pref, setPref] = useState(readThemePreference)
  const change = useCallback((next: ThemePreference) => {
    applyThemePreference(next)
    setPref(next)
  }, [])
  return [pref, change] as const
}
