import { AlertCircle, LoaderCircle, Paperclip, X } from 'lucide-react'
import { ACCEPT_FILES, formatSize, LIMITS_HINT } from '@/entities/attachment'
import { Button, FileButton, Thumbnail } from '@/shared/ui'
import { FileGlyph } from './FileGlyph'
import type { useUploads } from './useUploads'

/**
 * Files for a form (request, replacement). Each one uploads as soon as it is
 * picked, so the antivirus and limits answer before «Отправить»; the form
 * sends the stored ids and waits while anything is still on its way.
 */
export function AttachmentPicker({
  uploads,
  label = 'Фото и документы',
}: {
  uploads: ReturnType<typeof useUploads>
  label?: string
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-ui font-medium">{label}</legend>
      {uploads.items.length > 0 && (
        <ul className="mb-2 grid gap-1">
          {uploads.items.map((u) => {
            return (
              <li
                key={u.key}
                className="flex items-center gap-3 rounded-lg bg-field py-1.5 pr-1 pl-1.5"
              >
                {u.status === 'failed' ? (
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-status-replace-soft text-status-replace-ink">
                    <AlertCircle size={17} strokeWidth={1.75} />
                  </span>
                ) : u.preview ? (
                  <Thumbnail
                    src={u.preview}
                    alt=""
                    busy={u.status === 'uploading'}
                    className="size-9 shrink-0 rounded-md"
                  />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-sheet text-ink-muted">
                    {u.status === 'uploading' ? (
                      <LoaderCircle size={17} strokeWidth={1.75} className="animate-spin" />
                    ) : (
                      <FileGlyph name={u.file.name} size={17} strokeWidth={1.75} />
                    )}
                  </span>
                )}
                <span className="grid min-w-0 flex-1">
                  {u.status === 'failed' ? (
                    <span className="text-label text-status-replace-ink">{u.error}</span>
                  ) : (
                    <>
                      <span className="truncate text-ui">{u.file.name}</span>
                      <span className="text-label text-ink-muted">
                        {u.status === 'uploading'
                          ? 'Проверяем и загружаем…'
                          : formatSize(u.file.size)}
                      </span>
                    </>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  icon={X}
                  aria-label={`Убрать ${u.file.name}`}
                  onClick={() => uploads.remove(u.key)}
                />
              </li>
            )
          })}
        </ul>
      )}
      <FileButton
        multiple
        accept={ACCEPT_FILES}
        onFiles={uploads.add}
        variant="secondary"
        size="sm"
        icon={Paperclip}
      >
        Прикрепить файлы
      </FileButton>
      <p className="mt-1.5 text-label text-ink-muted">{LIMITS_HINT}</p>
    </fieldset>
  )
}
