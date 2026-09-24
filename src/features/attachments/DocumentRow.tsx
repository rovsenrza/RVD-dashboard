import type { Attachment } from '@/entities/types'
import { Button } from '@/shared/ui'
import { FileGlyph } from './FileGlyph'
import { fileMeta } from './files'

/** A document in a list: glyph tile, name, «PDF · 1,2 МБ · who»; the whole row opens the viewer. */
export function DocumentRow({ file, onOpen }: { file: Attachment; onOpen: () => void }) {
  return (
    <Button
      variant="ghost"
      size="auto"
      onClick={onOpen}
      className="h-auto w-full gap-3 py-2 whitespace-normal"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-field text-ink-muted">
        <FileGlyph name={file.fileName} size={17} strokeWidth={1.75} />
      </span>
      <span className="grid min-w-0">
        <span className="truncate text-sm text-ink">{file.fileName}</span>
        <span className="text-label text-ink-muted">
          {fileMeta(file)} · {file.uploadedBy}
        </span>
      </span>
    </Button>
  )
}
