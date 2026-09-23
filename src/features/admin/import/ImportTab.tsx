import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import type { CabinetUser, Equipment, Product } from '@/entities/types'
import { useSession } from '@/app/session'
import { api } from '@/shared/api/client'
import { keys, type UserDraft } from '@/shared/api/queries'
import { Button, Card, FileButton, useToast } from '@/shared/ui'
import { downloadTemplate, readRows, XLSX_TYPES } from './excel'
import { ImportDialog, type ImportOutcome } from './ImportDialog'
import {
  checkInstallations,
  checkUsers,
  INSTALL_COLUMNS,
  USER_COLUMNS,
  type CheckedRow,
  type ImportCheck,
  type ImportColumn,
  type InstallationRow,
} from './validate'

type Open =
  | { kind: 'users'; fileName: string; rows: CheckedRow<UserDraft>[] }
  | { kind: 'installations'; fileName: string; rows: CheckedRow<InstallationRow>[] }

/** Writes row by row through the ordinary endpoints, so each row is validated and logged as usual. */
async function each<T>(
  ready: { line: number; value: T }[],
  write: (value: T) => Promise<unknown>,
): Promise<ImportOutcome> {
  const failed: ImportOutcome['failed'] = []
  for (const { line, value } of ready) {
    try {
      await write(value)
    } catch (e) {
      failed.push({ line, message: e instanceof Error ? e.message : 'не удалось записать' })
    }
  }
  return { done: ready.length - failed.length, failed }
}

export function ImportTab() {
  const { branches } = useSession()
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState<Open | null>(null)
  const [reading, setReading] = useState(false)

  /** Read the file, check it against current data, and open the review; file-level problems go to a toast. */
  const load = async <T,>(
    file: File,
    check: (sheet: Awaited<ReturnType<typeof readRows>>) => Promise<ImportCheck<T>>,
    kind: Open['kind'],
  ) => {
    setReading(true)
    try {
      const result = await check(await readRows(file))
      if ('error' in result) toast(result.error, 'error')
      else setOpen({ kind, fileName: file.name, rows: result.rows } as Open)
    } catch {
      toast('Не удалось прочитать файл — нужен .xlsx', 'error')
    } finally {
      setReading(false)
    }
  }

  const refresh = (...groups: (readonly unknown[])[]) => {
    for (const queryKey of [...groups, keys.audit]) qc.invalidateQueries({ queryKey })
  }

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ImportCard
          title="Пользователи"
          description="Новые учётные записи кабинета. Каждому уйдёт приглашение на почту. Для механика укажите ровно один филиал; пустая ячейка «Филиалы» — вся компания."
          columns={USER_COLUMNS}
          busy={reading}
          onTemplate={() =>
            downloadTemplate(
              'Шаблон — пользователи.xlsx',
              USER_COLUMNS.map((c) => c.header + (c.required ? '*' : '')),
              ['Петров Пётр', 'petrov@company.ru', 'Механик', branches[0]?.name ?? ''],
            )
          }
          onFile={(file) =>
            load(
              file,
              async (sheet) =>
                checkUsers(sheet, await api.get<CabinetUser[]>('/admin/users'), branches),
              'users',
            )
          }
        />
        <ImportCard
          title="Установка изделий на технику"
          description="Какое изделие, на какой машине, в каком месте и с какой даты стоит. Справочники изделий и техники ведутся в 1С — их здесь не создают."
          columns={INSTALL_COLUMNS}
          busy={reading}
          onTemplate={() =>
            downloadTemplate(
              'Шаблон — установка изделий.xlsx',
              INSTALL_COLUMNS.map((c) => c.header + (c.required ? '*' : '')),
              ['48703', 'НТ04', 'Ковш', '12.07.2026', 'К-1003'],
            )
          }
          onFile={(file) =>
            load(
              file,
              async (sheet) =>
                checkInstallations(
                  sheet,
                  // The whole company, not the branch picked in the header.
                  await api.get<Product[]>('/products'),
                  await api.get<Equipment[]>('/equipment'),
                ),
              'installations',
            )
          }
        />
      </div>

      {open?.kind === 'users' && (
        <ImportDialog
          fileName={open.fileName}
          columns={USER_COLUMNS}
          rows={open.rows}
          onClose={() => setOpen(null)}
          onImport={async (ready) => {
            const outcome = await each(ready, (draft) => api.post('/admin/users', draft))
            refresh(keys.users, keys.branches)
            toast(
              `Добавлено пользователей: ${outcome.done}`,
              outcome.failed.length ? 'error' : 'ok',
            )
            return outcome
          }}
        />
      )}
      {open?.kind === 'installations' && (
        <ImportDialog
          fileName={open.fileName}
          columns={INSTALL_COLUMNS}
          rows={open.rows}
          onClose={() => setOpen(null)}
          onImport={async (ready) => {
            const outcome = await each(ready, (r) => api.patch(`/products/${r.productId}`, r.patch))
            refresh(['products'], ['equipment'], ['dashboard'])
            toast(`Обновлено изделий: ${outcome.done}`, outcome.failed.length ? 'error' : 'ok')
            return outcome
          }}
        />
      )}
    </>
  )
}

function ImportCard({
  title,
  description,
  columns,
  busy,
  onTemplate,
  onFile,
}: {
  title: string
  description: ReactNode
  columns: ImportColumn[]
  busy: boolean
  onTemplate: () => void
  onFile: (file: File) => void
}) {
  return (
    <Card title={title}>
      <p className="text-ui text-ink-secondary">{description}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {columns.map((c) => (
          <span
            key={c.key}
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-field px-2.5 text-label text-ink-secondary"
          >
            <FileSpreadsheet size={13} strokeWidth={1.75} className="text-ink-faint" aria-hidden />
            {c.header}
            {c.required && <span className="text-status-replace-ink">*</span>}
          </span>
        ))}
      </div>
      <p className="mt-2 text-label text-ink-muted">
        * обязательные колонки. Порядок колонок не важен.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <FileButton size="sm" icon={Upload} accept={XLSX_TYPES} onFile={onFile} disabled={busy}>
          {busy ? 'Читаем файл…' : 'Загрузить .xlsx'}
        </FileButton>
        <Button size="sm" variant="secondary" icon={Download} onClick={onTemplate}>
          Скачать шаблон
        </Button>
      </div>
    </Card>
  )
}
