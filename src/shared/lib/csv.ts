import { downloadBlob } from './download'

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

const escape = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Semicolon-separated with a BOM: that is what Excel in a Russian locale opens
 * as columns with Cyrillic intact, without an import wizard.
 */
export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const lines = [
    columns.map((c) => escape(c.header)).join(';'),
    ...rows.map((r) => columns.map((c) => escape(c.value(r))).join(';')),
  ]
  downloadBlob(
    filename,
    new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
  )
}
