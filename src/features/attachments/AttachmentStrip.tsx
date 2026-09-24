import { useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { Paperclip } from 'lucide-react'
import type { Attachment } from '@/entities/types'
import { Button, Thumbnail } from '@/shared/ui'
import { AttachmentViewer } from './AttachmentViewer'
import { fileIcon } from './files'

/** Files of a history entry, inline: photos as small tiles, documents by name. */
export function AttachmentStrip({ files }: { files: Attachment[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!files.length) return null
  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {files.map((a, i) =>
          a.kind === 'photo' ? (
            <Thumbnail
              key={a.id}
              src={a.previewUrl ?? a.url}
              alt={a.fileName}
              onClick={() => setOpen(i)}
              className="size-12 rounded-md"
            />
          ) : (
            <Button
              key={a.id}
              variant="secondary"
              size="sm"
              icon={fileIcon(a.fileName)}
              onClick={() => setOpen(i)}
              className="h-12 max-w-56 pointer-coarse:h-12"
            >
              <span className="truncate">{a.fileName}</span>
            </Button>
          ),
        )}
      </div>
      {open !== null && (
        <AttachmentViewer files={files} start={open} onClose={() => setOpen(null)} />
      )}
    </>
  )
}

// A clickable row must not also open when its files button (or the viewer
// portalled out of it) is used; React bubbles portal events up the tree.
const keep = (e: SyntheticEvent) => e.stopPropagation()
const keepEnter = (e: KeyboardEvent) => e.key === 'Enter' && e.stopPropagation()

/**
 * Beside a row's key value: a paperclip with the count, opening the viewer.
 * Nothing at all when there are no files, so tables gain no mostly-empty column.
 */
export function AttachmentsButton({ files }: { files: Attachment[] }) {
  const [open, setOpen] = useState(false)
  if (!files.length) return null
  return (
    <span onClick={keep} onKeyDown={keepEnter} className="-my-1.5">
      <Button
        variant="ghost"
        size="sm"
        icon={Paperclip}
        aria-label={`Файлы: ${files.length}`}
        onClick={() => setOpen(true)}
        className="px-1.5 font-normal text-ink-muted tabular"
      >
        {files.length}
      </Button>
      {open && <AttachmentViewer files={files} onClose={() => setOpen(false)} />}
    </span>
  )
}
