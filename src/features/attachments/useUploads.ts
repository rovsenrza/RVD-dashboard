import { useEffect, useRef, useState } from 'react'
import type { Attachment } from '@/entities/types'
import { fileFormat, fileProblem, MAX_FILES, tooManyFiles } from '@/entities/attachment'
import { ApiError } from '@/shared/api/client'
import { useUploadAttachment } from '@/shared/api/queries'
import { useToast } from '@/shared/ui'

export interface Upload {
  key: string
  file: File
  /** Local copy of a photo, so its tile shows before the server answers */
  preview: string | null
  status: 'uploading' | 'done' | 'failed'
  attachment?: Attachment
  error?: string
}

let seq = 0

/**
 * Pick → check → upload, file by file. The limits are checked before a file
 * travels; the server's own refusal (antivirus, limits) comes back per file.
 *
 * With `productId` files land on the hose at once: a finished upload leaves
 * this list for the card's own, and a refusal is a toast. Without it they are
 * drafts for a form — kept here, refusals included, until the form submits
 * `ids` and the server binds them to what it creates.
 */
export function useUploads({ productId, taken = 0 }: { productId?: string; taken?: number } = {}) {
  const upload = useUploadAttachment(productId)
  const toast = useToast()
  const direct = productId !== undefined
  const [items, setItems] = useState<Upload[]>([])
  const previews = useRef(new Set<string>())

  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const patch = (key: string, next: Partial<Upload>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...next } : i)))

  const remove = (key: string) =>
    setItems((list) => {
      const gone = list.find((i) => i.key === key)
      if (gone?.preview && previews.current.delete(gone.preview)) URL.revokeObjectURL(gone.preview)
      return list.filter((i) => i.key !== key)
    })

  const add = (files: File[]) => {
    let room = MAX_FILES - taken - items.filter((i) => i.status !== 'failed').length
    const added: Upload[] = []
    for (const file of files) {
      const problem = fileProblem(file) ?? (room > 0 ? null : tooManyFiles(file.name))
      if (problem && direct) {
        toast(problem, 'error')
        continue
      }
      const key = `u-${++seq}`
      if (problem) {
        added.push({ key, file, preview: null, status: 'failed', error: problem })
        continue
      }
      room--
      const preview = fileFormat(file.name)?.kind === 'photo' ? URL.createObjectURL(file) : null
      if (preview) previews.current.add(preview)
      added.push({ key, file, preview, status: 'uploading' })
      upload.mutateAsync(file).then(
        (attachment) => (direct ? remove(key) : patch(key, { status: 'done', attachment })),
        (err: unknown) => {
          const error =
            // 422 carries the reason in words (limits, antivirus); anything else is a hiccup.
            err instanceof ApiError && err.status === 422
              ? err.message
              : `«${file.name}»: не удалось загрузить, попробуйте ещё раз`
          if (direct) {
            toast(error, 'error')
            remove(key)
          } else patch(key, { status: 'failed', error })
        },
      )
    }
    setItems((list) => [...list, ...added])
  }

  return {
    items,
    add,
    remove,
    /** Stored drafts, in the order they were picked */
    ids: items.flatMap((i) => (i.attachment ? [i.attachment.id] : [])),
    busy: items.some((i) => i.status === 'uploading'),
  }
}
