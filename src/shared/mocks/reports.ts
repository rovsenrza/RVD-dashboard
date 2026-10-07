import { formatISO } from 'date-fns'
import type { Report, ReportId } from '@/entities/types'
import { buildReport as build } from '@/entities/report'
import { branchSummaries, equipment, products, replacements, requests, settings } from './data'

export interface ReportParams {
  branch: string | null
  from: string | null
  to: string | null
}

/** The demo's report: the same builder the API runs over its cache (@rvd/contracts). */
export function buildReport(id: ReportId, { branch, from, to }: ReportParams): Report | null {
  const now = new Date()
  return build(
    id,
    { products, equipment, replacements, requests, branches: branchSummaries() },
    {
      branch,
      from,
      to,
      rules: settings,
      today: formatISO(now, { representation: 'date' }),
      generatedAt: now.toISOString(),
    },
  )
}
