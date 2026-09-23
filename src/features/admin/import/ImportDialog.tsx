import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge, Button, DataTable, Dialog } from '@/shared/ui'
import type { CheckedRow, ImportColumn } from './validate'

export interface ImportOutcome {
  done: number
  failed: { line: number; message: string }[]
}

/**
 * The check before anything is written: every row with its verdict, the
 * counts on top, and one button that imports only the rows that passed.
 */
export function ImportDialog<T>({
  fileName,
  columns,
  rows,
  onImport,
  onClose,
}: {
  fileName: string
  columns: ImportColumn[]
  rows: CheckedRow<T>[]
  onImport: (ready: { line: number; value: T }[]) => Promise<ImportOutcome>
  onClose: () => void
}) {
  const [running, setRunning] = useState(false)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const ready = rows.flatMap((r) => (r.value ? [{ line: r.line, value: r.value }] : []))
  const failedAt = useMemo(
    () => new Map(outcome?.failed.map((f) => [f.line, f.message])),
    [outcome],
  )

  const table = useMemo(
    () =>
      [
        {
          id: 'line',
          header: 'Строка',
          accessorFn: (r) => r.line,
          meta: { mobile: 'title' },
          cell: (c) => <span className="text-ink-muted tabular">{c.getValue() as number}</span>,
        },
        ...columns.map<ColumnDef<CheckedRow<T>, unknown>>((col) => ({
          id: col.key,
          header: col.header,
          accessorFn: (r) => r.cells[col.key],
          cell: (c) => (c.getValue() as string) || '—',
        })),
        {
          id: 'verdict',
          header: 'Проверка',
          meta: { mobile: 'aside' },
          accessorFn: (r) => r.errors.join('; '),
          cell: ({ row }) => {
            const r = row.original
            const late = failedAt.get(r.line)
            if (r.errors.length || late)
              return (
                <span className="block max-w-[22rem] text-label whitespace-normal text-status-replace-ink">
                  {late ?? r.errors.join('; ')}
                </span>
              )
            return (
              <Badge tone="ok" dot>
                {outcome ? 'Импортировано' : 'Готово'}
              </Badge>
            )
          },
        },
      ] as ColumnDef<CheckedRow<T>, unknown>[],
    [columns, failedAt, outcome],
  )

  const run = async () => {
    setRunning(true)
    setOutcome(await onImport(ready))
    setRunning(false)
  }

  const bad = rows.length - ready.length
  return (
    <Dialog
      open
      onClose={onClose}
      className="sm:max-w-4xl"
      title={`Проверка файла «${fileName}»`}
      description={
        outcome
          ? `Импортировано ${outcome.done} из ${ready.length}.${outcome.failed.length ? ' Причины отказа — в колонке «Проверка».' : ''}`
          : `Строк: ${rows.length} · готовы к импорту: ${ready.length} · с ошибками: ${bad}. Строки с ошибками пропускаются — исправьте их в файле и загрузите снова.`
      }
      footer={
        outcome ? (
          <Button size="sm" onClick={onClose}>
            Готово
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Отмена
            </Button>
            <Button size="sm" disabled={!ready.length || running} onClick={run}>
              {running ? 'Импортируем…' : `Импортировать ${ready.length}`}
            </Button>
          </>
        )
      }
    >
      <DataTable embedded data={rows} columns={table} pageSize={50} />
    </Dialog>
  )
}
