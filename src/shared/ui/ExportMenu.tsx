import { useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { downloadCsv, downloadXlsx, type ExportColumn } from '@/shared/lib/export'
import { formatDateTime } from '@/shared/lib/utils'
import { Button } from './Button'
import { Menu } from './Menu'
import { useToast } from './Toast'

/**
 * «Экспорт» on a registry: the rows the user sees right now — filters, search
 * and sort applied, every page — as Excel or as CSV for other systems.
 */
export function ExportMenu<T>({
  fileName,
  title,
  lines,
  columns,
  rows,
}: {
  /** Without extension */
  fileName: string
  /** Heading of the Excel sheet */
  title: string
  /** Parameter lines under the heading: scope and filters; «Сформировано …» is added here. */
  lines?: (string | null | false | undefined)[]
  columns: ExportColumn<T>[]
  rows: () => T[]
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const xlsx = async () => {
    setBusy(true)
    try {
      await downloadXlsx(fileName, columns, rows(), {
        title,
        lines: [
          ...(lines ?? []).filter((l): l is string => !!l),
          `Сформировано ${formatDateTime(new Date().toISOString())}`,
        ],
      })
    } catch {
      toast('Не удалось сформировать файл Excel, попробуйте ещё раз', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Menu
      trigger={(open) => (
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          trailingIcon={ChevronDown}
          aria-expanded={open}
          disabled={busy}
        >
          {busy ? 'Готовим файл…' : 'Экспорт'}
        </Button>
      )}
      items={[
        { label: 'Excel (.xlsx)', icon: FileSpreadsheet, onSelect: xlsx },
        {
          label: 'CSV для других систем',
          icon: FileText,
          onSelect: () => downloadCsv(`${fileName}.csv`, columns, rows()),
        },
      ]}
    />
  )
}
