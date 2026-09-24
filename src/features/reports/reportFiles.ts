import type { Report, ReportValue } from '@/entities/types'
import { periodText, reportFileName, reportText, type ReportMeta } from '@/entities/report'
import { downloadXlsx, type ExportColumn } from '@/shared/lib/export'
import { formatDate, formatDateTime, plural } from '@/shared/lib/utils'

type Row = Record<string, ReportValue>

/** The parameter lines every copy of a report carries: screen, Excel and paper. */
export const reportLines = (report: Report, company: string) => [
  company,
  report.branch ?? 'Все филиалы',
  report.period ? `Период: ${periodText(report.period)}` : `На ${formatDate(report.generatedAt)}`,
  `Сформировано ${formatDateTime(report.generatedAt)}`,
]

export const rowCount = (n: number) =>
  `${n.toLocaleString('ru-RU')} ${plural(n, 'строка', 'строки', 'строк')}`

/**
 * Excel from the report the server built. The BFF will offer the same file at
 * `/reports/:id.xlsx`; until then the browser writes it from the JSON.
 */
export function downloadReportXlsx(report: Report, company: string) {
  const columns: ExportColumn<Row>[] = report.columns.map((c) => ({
    header: c.header,
    width: c.width,
    type: c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text',
    // A status travels as its label: a code means nothing in a spreadsheet.
    value: (r) => (c.type === 'status' ? reportText(c, r[c.key]) : r[c.key]),
  }))
  return downloadXlsx(reportFileName(report.title, report.generatedAt), columns, report.rows, {
    title: report.title,
    lines: reportLines(report, company),
    totals: report.totals ?? undefined,
  })
}

/**
 * The print view for «PDF». The branch rides in the URL because the view opens
 * in its own tab; on the BFF the same query returns a rendered `.pdf`.
 */
export function printUrl(
  meta: ReportMeta,
  branch: string | null,
  period: { from: string; to: string } | null,
) {
  const q = new URLSearchParams({ r: meta.id, print: '1' })
  if (branch) q.set('branch', branch)
  if (meta.period && period) {
    q.set('from', period.from)
    q.set('to', period.to)
  }
  return `/reports/print?${q}`
}
