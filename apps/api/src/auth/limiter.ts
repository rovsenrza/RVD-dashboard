/**
 * Failed attempts per key (an address, an account) in a sliding window (Д29):
 * past `max` the key waits until its oldest failure leaves the window. In
 * memory, which holds for the one API process the cabinet runs; a second
 * instance would share it through Postgres or Redis.
 */
export function attemptLimiter({
  max,
  windowMs,
  now = Date.now,
}: {
  max: number
  windowMs: number
  now?: () => number
}) {
  const failures = new Map<string, number[]>()
  const recent = (key: string) => (failures.get(key) ?? []).filter((t) => t > now() - windowMs)
  return {
    /** Seconds the key must wait, or 0 when it may try. */
    wait(key: string): number {
      const r = recent(key)
      return r.length < max ? 0 : Math.ceil((r[0] + windowMs - now()) / 1000)
    },
    fail(key: string) {
      failures.set(key, [...recent(key), now()])
      // Forget keys whose window has passed, so the map stays the size of an attack, not of history.
      if (failures.size > 10_000)
        for (const [k] of failures) if (!recent(k).length) failures.delete(k)
    },
    clear(key: string) {
      failures.delete(key)
    },
  }
}

export type Limiter = ReturnType<typeof attemptLimiter>

/** «через 7 мин.» */
export const waitText = (seconds: number) =>
  `Слишком много неудачных попыток — попробуйте через ${Math.max(1, Math.ceil(seconds / 60))} мин.`
