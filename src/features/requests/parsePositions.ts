export interface ParsedPosition {
  catalogNumber: string
  quantity: number
}

const MAX_QUANTITY = 99

/** A number, a separator (space, ; , tab, × *, or " x"), then the quantity at the end of the line. */
const WITH_QUANTITY = /^(.+?)(?:[\s;,×*]+|\s[xх]\s*)(\d{1,3})$/i

/**
 * Turns a pasted list into request positions, one per line: a catalogue number,
 * optionally followed by a quantity ("07098-010A9 5", "07098-010A9; 5",
 * "07098-010A9 x5", "07098-010A9×5"). A line without a quantity means one.
 * Repeated numbers are summed, blank lines skipped, order kept.
 */
export function parsePositions(text: string): ParsedPosition[] {
  const byNumber = new Map<string, ParsedPosition>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const match = WITH_QUANTITY.exec(line)
    const catalogNumber = (match ? match[1] : line).trim()
    const quantity = match ? Math.min(MAX_QUANTITY, Math.max(1, Number(match[2]))) : 1
    const key = catalogNumber.toLowerCase()
    const known = byNumber.get(key)
    if (known) known.quantity = Math.min(MAX_QUANTITY, known.quantity + quantity)
    else byNumber.set(key, { catalogNumber, quantity })
  }
  return [...byNumber.values()]
}
