import { downloadBlob } from './download'

/** One column of a download: how to read the value, and what kind of value it is for Excel. */
export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
  /** `date` values are ISO `yyyy-MM-dd`; Excel receives a real date. */
  type?: 'text' | 'number' | 'date'
  /** Excel column width in characters */
  width?: number
}

const escape = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Semicolon-separated with a BOM: that is what Excel in a Russian locale opens
 * as columns with Cyrillic intact, without an import wizard.
 */
export function downloadCsv<T>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const lines = [
    columns.map((c) => escape(c.header)).join(';'),
    ...rows.map((r) => columns.map((c) => escape(c.value(r))).join(';')),
  ]
  downloadBlob(filename, new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
}

/**
 * A calendar day for Excel. The writer stores UTC, so a local midnight east of
 * Greenwich would land on the previous evening and show as the day before.
 */
export const excelDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * An .xlsx sheet people can sort and sum: an optional title and parameter
 * lines, a bold header that stays on screen, real numbers and dates, and a
 * bold totals row. The writer is loaded only when a file is asked for.
 */
export async function downloadXlsx<T>(
  fileName: string,
  columns: ExportColumn<T>[],
  rows: T[],
  { title, lines = [], totals }: { title?: string; lines?: string[]; totals?: T } = {},
) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const bold = 'bold' as const
  const cell = (c: ExportColumn<T>, row: T, strong = false) => {
    const v = c.value(row)
    const fontWeight = strong ? bold : undefined
    if (v === null || v === undefined || v === '') return null
    if (c.type === 'date')
      return { value: excelDate(String(v)), type: Date, format: 'dd.mm.yyyy', fontWeight }
    if (typeof v === 'number') return { value: v, type: Number, fontWeight }
    return { value: String(v), type: String, fontWeight }
  }
  const head = [
    ...(title ? [[{ value: title, fontWeight: bold, fontSize: 14 }]] : []),
    ...lines.map((value) => [{ value }]),
    ...(title || lines.length ? [[null]] : []),
  ]
  const header = columns.map((c) => ({
    value: c.header,
    fontWeight: bold,
    backgroundColor: '#F3F3F1',
    bottomBorderStyle: 'thin' as const,
    bottomBorderColor: '#D6D6D0',
    wrap: true,
    alignVertical: 'top' as const,
  }))
  const data = [
    ...head,
    header,
    ...rows.map((r) => columns.map((c) => cell(c, r))),
    ...(totals ? [columns.map((c) => cell(c, totals, true))] : []),
  ]
  await writeExcelFile(data, {
    columns: columns.map((c) => ({ width: c.width ?? Math.max(c.header.length + 2, 10) })),
    stickyRowsCount: head.length + 1,
  }).toFile(`${fileName}.xlsx`)
}
