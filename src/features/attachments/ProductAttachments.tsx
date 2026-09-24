import { useState, type DragEvent } from 'react'
import { Camera, LoaderCircle, Plus, Upload as UploadIcon } from 'lucide-react'
import { ACCEPT_FILES, LIMITS_HINT } from '@/entities/attachment'
import { useDeleteAttachment, useProductAttachments } from '@/shared/api/queries'
import { Button, Card, EmptyState, FileButton, QueryState, Skeleton, Thumbnail } from '@/shared/ui'
import { AttachmentViewer } from './AttachmentViewer'
import { fileIcon, fileMeta } from './files'
import { useUploads } from './useUploads'

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')

const Heading = ({ children }: { children: string }) => (
  <h3 className="mb-2 text-caption font-medium tracking-wide text-ink-muted uppercase">
    {children}
  </h3>
)

/**
 * «Фото и документы» on the hose card: photos as a grid, documents as a list,
 * each opening the viewer. Files land on the hose as soon as they are picked
 * or dropped onto the sheet.
 */
export function ProductAttachments({
  productId,
  readOnly = false,
}: {
  productId: string
  /** A written-off hose keeps its files but takes no new ones. */
  readOnly?: boolean
}) {
  const query = useProductAttachments(productId)
  const files = query.data ?? []
  const uploads = useUploads({ productId, taken: files.length })
  const remove = useDeleteAttachment(productId)
  const [open, setOpen] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  // The viewer walks the files in the order they are shown: photos, then documents.
  const photos = files.filter((f) => f.kind === 'photo')
  const documents = files.filter((f) => f.kind === 'document')
  const ordered = [...photos, ...documents]
  const pendingPhotos = uploads.items.filter((u) => u.preview)
  const pendingDocuments = uploads.items.filter((u) => !u.preview)
  const empty = !files.length && !uploads.items.length

  const drop = readOnly
    ? {}
    : {
        onDragEnter: (e: DragEvent) => hasFiles(e) && setDragging(true),
        onDragOver: (e: DragEvent) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        },
        onDragLeave: (e: DragEvent) =>
          !e.currentTarget.contains(e.relatedTarget as Node | null) && setDragging(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          setDragging(false)
          uploads.add(Array.from(e.dataTransfer.files))
        },
      }

  const add = !readOnly && (
    <FileButton
      multiple
      accept={ACCEPT_FILES}
      onFiles={uploads.add}
      variant="secondary"
      size="sm"
      icon={Plus}
    >
      Добавить
    </FileButton>
  )

  return (
    <div className="relative" {...drop}>
      <Card title="Фото и документы" action={!empty && add}>
        <QueryState
          query={query}
          skeleton={
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((k) => (
                <Skeleton key={k} className="aspect-square rounded-lg" />
              ))}
            </div>
          }
        >
          {() =>
            empty ? (
              <EmptyState
                inset
                icon={Camera}
                title="Фото и документов пока нет"
                description={
                  readOnly
                    ? 'К списанному изделию файлы не добавляются.'
                    : 'Фото установки или повреждения, паспорт, акт — всё, что пригодится при следующей замене.'
                }
                action={add}
              />
            ) : (
              <div className="grid gap-5">
                {(photos.length > 0 || pendingPhotos.length > 0) && (
                  <section>
                    <Heading>Фото</Heading>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {photos.map((a, i) => (
                        <Thumbnail
                          key={a.id}
                          src={a.previewUrl ?? a.url}
                          alt={a.fileName}
                          onClick={() => setOpen(i)}
                        />
                      ))}
                      {pendingPhotos.map((u) => (
                        <Thumbnail key={u.key} src={u.preview!} alt={u.file.name} busy />
                      ))}
                    </div>
                  </section>
                )}
                {(documents.length > 0 || pendingDocuments.length > 0) && (
                  <section>
                    <Heading>Документы</Heading>
                    <ul className="-mx-2 grid">
                      {documents.map((a, i) => {
                        const Icon = fileIcon(a.fileName)
                        return (
                          <li key={a.id}>
                            <Button
                              variant="ghost"
                              size="auto"
                              onClick={() => setOpen(photos.length + i)}
                              className="h-auto w-full gap-3 py-2 whitespace-normal"
                            >
                              <FileTile icon={Icon} />
                              <span className="grid min-w-0">
                                <span className="truncate text-sm text-ink">{a.fileName}</span>
                                <span className="text-label text-ink-muted">
                                  {fileMeta(a)} · {a.uploadedBy}
                                </span>
                              </span>
                            </Button>
                          </li>
                        )
                      })}
                      {pendingDocuments.map((u) => (
                        <li key={u.key} className="flex items-center gap-3 px-2 py-2">
                          <FileTile icon={LoaderCircle} spin />
                          <span className="grid min-w-0">
                            <span className="truncate text-sm">{u.file.name}</span>
                            <span className="text-label text-ink-muted">
                              Проверяем и загружаем…
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )
          }
        </QueryState>
        {!readOnly && (
          <p className="mt-4 text-label text-ink-muted">
            {LIMITS_HINT}
            <span className="pointer-coarse:hidden"> · можно перетащить файлы на этот блок</span>
          </p>
        )}
      </Card>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-sheet bg-brand-soft/90 text-brand-deep shadow-[inset_0_0_0_2px_var(--color-brand)]">
          <span className="flex items-center gap-2 text-sm font-medium">
            <UploadIcon size={18} strokeWidth={1.75} />
            Отпустите, чтобы добавить к изделию
          </span>
        </div>
      )}

      {open !== null && (
        <AttachmentViewer
          files={ordered}
          start={open}
          onClose={() => setOpen(null)}
          onDelete={readOnly ? undefined : (a) => remove.mutateAsync(a.id)}
        />
      )}
    </div>
  )
}

function FileTile({ icon: Icon, spin = false }: { icon: typeof Camera; spin?: boolean }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-field text-ink-muted">
      <Icon size={17} strokeWidth={1.75} className={spin ? 'animate-spin' : undefined} />
    </span>
  )
}
