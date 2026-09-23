/** A cell as the reader hands it back: dates arrive as Date, numbers as number. */
export type Cell = string | number | boolean | Date | null

export const XLSX_TYPES = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** The first sheet as rows of cells. The decoder loads only when a file is actually chosen. */
export async function readRows(file: File): Promise<Cell[][]> {
  const { readSheet } = await import('read-excel-file/browser')
  return (await readSheet(file)) as unknown as Cell[][]
}

/** A ready-to-fill template: bold header row, one example row, columns sized to their titles. */
export async function downloadTemplate(
  fileName: string,
  headers: string[],
  example: (string | number)[],
) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const data = [
    headers.map((value) => ({ value, fontWeight: 'bold' as const })),
    example.map((value) => ({ value })),
  ]
  const columns = headers.map((h, i) => ({
    width: Math.max(h.length, String(example[i] ?? '').length) + 4,
  }))
  await writeExcelFile(data, { columns }).toFile(fileName)
}
