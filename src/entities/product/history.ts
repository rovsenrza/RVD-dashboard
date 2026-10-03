import type { LifecycleRecord } from '@/entities/types'

/** A run of register lines with one status, told as one step of the hose's history. */
export interface HistoryStep {
  first: LifecycleRecord
  /** How many lines the run holds: 1С re-posts a status with every document that touches the hose */
  count: number
}

/**
 * The hose's history as a person reads it: each change of status once, with
 * the date it first took effect. The register's repeats (six «На складе» in a
 * minute) fold into one step; nothing is dropped from the data itself.
 */
export function historySteps(records: LifecycleRecord[]): HistoryStep[] {
  const steps: HistoryStep[] = []
  for (const record of records) {
    const last = steps.at(-1)
    if (last && last.first.status === record.status) last.count++
    else steps.push({ first: record, count: 1 })
  }
  return steps
}
