import css from '../../index.css?raw'

/**
 * Guards the colour tokens in src/index.css: the two dark blocks (OS preference
 * and explicit data-theme) must match, and every text/ground pair the design
 * system promises must reach WCAG AA (4.5:1) in both themes.
 */

function block(selector: string): string {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`selector not found: ${selector}`)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

function colors(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/--color-([\w-]+):\s*([^;]+);/g))
    out[name] = value.trim()
  return out
}

const light = colors(block('@theme {'))
const dark = colors(block(":root[data-theme='dark']"))
const darkByPreference = colors(block(":root:not([data-theme='light'])"))

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** [text, ground] pairs that carry readable text somewhere in the UI. */
const PAIRS: [string, string][] = [
  ['ink', 'field'],
  ['ink', 'sheet'],
  ['ink', 'pop'],
  ['ink-secondary', 'sheet'],
  ['ink-muted', 'field'],
  ['ink-muted', 'sheet'],
  ['ink-muted', 'sheet-muted'],
  ['ink-muted', 'pop'],
  ['ink-muted', 'row-hover'],
  ['brand-deep', 'sheet'],
  ['brand-deep', 'brand-soft'],
  ['on-brand', 'brand'],
  ['on-brand', 'brand-dark'],
  ['on-brand', 'brand-press'],
  ['rail-ink', 'rail'],
  ['rail-muted', 'rail'],
  ['sheet', 'status-replace-ink'],
  ...(['ok', 'warn', 'replace', 'none'] as const).flatMap((s): [string, string][] => [
    [`status-${s}-ink`, `status-${s}-soft`],
    [`status-${s}-ink`, 'sheet'],
  ]),
]

describe('colour tokens', () => {
  it('dark blocks for the OS preference and data-theme are identical', () => {
    expect(darkByPreference).toEqual(dark)
  })

  it('dark theme redefines every opaque light colour', () => {
    const opaque = Object.keys(light).filter((k) => light[k].startsWith('#'))
    expect(opaque.filter((k) => !(k in dark))).toEqual([])
  })

  describe.each([
    ['light', light],
    ['dark', dark],
  ])('%s theme', (_, theme) => {
    it.each(PAIRS)('%s on %s reaches AA', (text, ground) => {
      expect(contrast(theme[text], theme[ground])).toBeGreaterThanOrEqual(4.5)
    })
  })
})
