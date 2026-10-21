import type { Attachment } from '@/entities/types'
import { fileFormat, fileProblem, MAX_FILES, tooManyFiles } from '@/entities/attachment'

/** What a file belongs to. A draft (no owner) waits for the request or replacement that claims it. */
export interface AttachmentOwner {
  kind: 'product' | 'request' | 'replacement'
  id: string
}

interface Stored {
  meta: Attachment
  owner: AttachmentOwner | null
  blob: Blob
}

// In memory, like every other mock mutation: a reload forgets uploads. The BFF
// keeps files on disk or S3 with metadata in Postgres, and purges unclaimed drafts.
const store = new Map<string, Stored>()
let seq = 0

const sameOwner = (a: AttachmentOwner | null, b: AttachmentOwner) =>
  a?.kind === b.kind && a.id === b.id

/** Newest first — the latest state of a hose is what people look for. */
export const attachmentsOf = (owner: AttachmentOwner): Attachment[] =>
  [...store.values()]
    .filter((s) => sameOwner(s.owner, owner))
    .map((s) => s.meta)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

export const storedFile = (id: string) => store.get(id) ?? null

/**
 * The antivirus stub. The BFF hands every upload to ClamAV before storing it;
 * here only the standard EICAR test file is caught, so the refusal can be shown.
 */
const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE'
const infected = async (file: Blob) => (await file.text()).includes(EICAR)

export async function storeUpload(
  file: File,
  owner: AttachmentOwner | null,
  uploadedBy: string,
): Promise<Attachment | { message: string }> {
  const problem = fileProblem(file)
  if (problem) return { message: problem }
  if (owner && attachmentsOf(owner).length >= MAX_FILES) return { message: tooManyFiles(file.name) }
  if (await infected(file))
    return { message: `«${file.name}» не прошёл проверку антивирусом и не сохранён` }

  const id = `att-${++seq}`
  const format = fileFormat(file.name)!
  const url = `/api/attachments/${id}/file`
  const meta: Attachment = {
    id,
    fileName: file.name,
    mimeType: format.mime,
    size: file.size,
    kind: format.kind,
    url,
    // The BFF renders a reduced copy; the mock serves the original.
    previewUrl: format.kind === 'photo' ? url : null,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  }
  store.set(id, { meta, owner, blob: file })
  return meta
}

/** Bind drafts to the record just created. Unknown or already claimed ids are ignored. */
export function claimAttachments(ids: string[] | undefined, owner: AttachmentOwner): Attachment[] {
  return (ids ?? []).flatMap((id) => {
    const s = store.get(id)
    if (!s || s.owner) return []
    s.owner = owner
    return [s.meta]
  })
}

export function deleteAttachment(id: string) {
  const s = store.get(id)
  if (s) store.delete(id)
  return s ?? null
}
