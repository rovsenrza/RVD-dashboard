import type { Db } from '../db/pool.ts'
import type { ODataClient } from '../onec/client.ts'
import { readHealth, recordFailure } from './health.ts'
import { runCheck, runSync, type SyncResult } from './sync.ts'

export interface SyncScheduler {
  /** Run now («Обновить сейчас»), unless a run is already going */
  kick: () => void
  running: () => boolean
  stop: () => void
}

export interface SchedulerOptions {
  /** Between checks, ms */
  intervalMs: number
  /** The local hour of the nightly rebuild */
  fullHour: number
  /** Where request statuses are read, when not 1С itself (the Д20 stand-in) */
  states?: ODataClient
  onRun?: (result: SyncResult) => void
  onError?: (error: unknown) => void
  now?: () => Date
}

const HOUR = 60 * 60 * 1000

/**
 * The sync worker (Д26), in the API process: a check every `intervalMs`, a
 * full rebuild once a night (or when a night was missed). When 1С does not
 * answer the cache stays as it is, the failure is recorded for the header's
 * banner and the next run tries again; requests keep waiting in the outbox.
 */
export function startSync(db: Db, client: ODataClient, options: SchedulerOptions): SyncScheduler {
  const now = options.now ?? (() => new Date())
  let busy = false
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const fullDue = async () => {
    const { full_at } = await readHealth(db)
    if (!full_at) return true
    const age = now().getTime() - full_at.getTime()
    return age > 26 * HOUR || (now().getHours() === options.fullHour && age > 2 * HOUR)
  }

  const schedule = () => {
    clearTimeout(timer)
    if (!stopped) timer = setTimeout(() => void tick(), options.intervalMs)
  }

  const tick = async () => {
    if (busy || stopped) return
    busy = true
    try {
      const result = (await fullDue())
        ? await runSync(db, client, options.states)
        : await runCheck(db, client, options.states)
      options.onRun?.(result)
    } catch (error) {
      await recordFailure(db, error).catch(() => undefined)
      options.onError?.(error)
    } finally {
      busy = false
      schedule()
    }
  }

  void tick()
  return {
    kick: () => {
      if (busy) return
      clearTimeout(timer)
      void tick()
    },
    running: () => busy,
    stop: () => {
      stopped = true
      clearTimeout(timer)
    },
  }
}
