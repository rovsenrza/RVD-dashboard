import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ImageOff, Trash2 } from 'lucide-react'
import type { Attachment } from '@/entities/types'
import { fileFormat } from '@/entities/attachment'
import { formatDateTime } from '@/shared/lib/utils'
import { Button, Dialog, useToast } from '@/shared/ui'
import { FileGlyph } from './FileGlyph'
import { fileMeta, saveAttachment } from './files'

const OPENS_IN: Record<string, string> = {
  PDF: 'программе для просмотра PDF',
  Word: 'Word',
  Excel: 'Excel',
}

/**
 * One file at a time, large: a photo as itself, a document as what it is and
 * where it opens. Arrows (on screen and on the keyboard) walk the set.
 */
export function AttachmentViewer({
  files,
  start = 0,
  onClose,
  onDelete,
}: {
  files: Attachment[]
  start?: number
  onClose: () => void
  /** Only a hose's own files can be deleted; without it there is no «Удалить». */
  onDelete?: (a: Attachment) => Promise<unknown>
}) {
  const toast = useToast()
  const [index, setIndex] = useState(start)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [broken, setBroken] = useState<string | null>(null)
  const count = files.length
  // The set can shrink under the viewer after a delete.
  const i = Math.min(index, count - 1)
  const a = files[i]

  const go = useCallback(
    (step: number) => {
      setConfirming(false)
      setIndex((n) => (Math.min(n, count - 1) + step + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (count < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [count, go])

  useEffect(() => {
    if (count === 0) onClose()
  }, [count, onClose])

  if (!a) return null
  const format = fileFormat(a.fileName)

  const save = async () => {
    setBusy('save')
    try {
      await saveAttachment(a)
    } catch {
      toast(`Не удалось скачать «${a.fileName}», попробуйте ещё раз`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!onDelete) return
    setBusy('delete')
    try {
      await onDelete(a)
      toast(`Файл «${a.fileName}» удалён`)
      setConfirming(false)
    } catch {
      toast(`Не удалось удалить «${a.fileName}»`, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={a.fileName}
      description={[
        count > 1 && `${i + 1} из ${count}`,
        fileMeta(a),
        `${formatDateTime(a.uploadedAt)}, ${a.uploadedBy}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      className="sm:max-w-3xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2 max-sm:[&>button]:flex-1">
          {/* Keyed, so «Отмена» never inherits the amber «Скачать» mid-transition. */}
          {confirming ? (
            <Fragment key="confirm">
              <p className="mr-auto text-ui max-sm:basis-full">
                Удалить файл из карточки изделия? Его перестанут видеть все.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                Отмена
              </Button>
              <Button variant="danger" size="sm" onClick={remove} disabled={busy === 'delete'}>
                {busy === 'delete' ? 'Удаляем…' : 'Удалить'}
              </Button>
            </Fragment>
          ) : (
            <Fragment key="actions">
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setConfirming(true)}
                  className="sm:mr-auto"
                >
                  Удалить
                </Button>
              )}
              <Button size="sm" icon={Download} onClick={save} disabled={busy === 'save'}>
                {busy === 'save' ? 'Скачиваем…' : 'Скачать'}
              </Button>
            </Fragment>
          )}
        </div>
      }
    >
      <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-lg bg-field">
        {a.kind === 'photo' && broken !== a.id ? (
          <img
            key={a.id}
            src={a.url}
            alt={a.fileName}
            onError={() => setBroken(a.id)}
            className="max-h-[62dvh] w-auto max-w-full object-contain"
          />
        ) : a.kind === 'photo' ? (
          <div className="grid justify-items-center gap-2 px-16 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-xl bg-sheet text-ink-muted shadow-sheet">
              <ImageOff size={26} strokeWidth={1.5} />
            </span>
            <p className="mt-1 text-sm font-medium">Фото не открывается</p>
            <p className="max-w-xs text-ui text-ink-muted">
              Браузер не смог его показать — скачайте файл и откройте на компьютере.
            </p>
          </div>
        ) : (
          <div className="grid justify-items-center gap-2 px-16 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-xl bg-sheet text-ink-muted shadow-sheet">
              <FileGlyph name={a.fileName} size={26} strokeWidth={1.5} />
            </span>
            <p className="mt-1 text-sm font-medium">Документ {format?.label}</p>
            <p className="max-w-xs text-ui text-ink-muted">
              Предпросмотра нет — скачайте файл, он откроется в{' '}
              {OPENS_IN[format?.label ?? ''] ?? 'подходящей программе'}.
            </p>
          </div>
        )}
        {count > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon-sm"
              icon={ChevronLeft}
              aria-label="Предыдущий файл"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full shadow-sheet"
            />
            <Button
              variant="secondary"
              size="icon-sm"
              icon={ChevronRight}
              aria-label="Следующий файл"
              onClick={() => go(1)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full shadow-sheet"
            />
          </>
        )}
      </div>
    </Dialog>
  )
}
