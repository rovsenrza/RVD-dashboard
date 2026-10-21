import { FileSpreadsheet, FileText, type LucideIcon } from 'lucide-react'
import type { Attachment } from '@/entities/types'
import { fileFormat, formatSize } from '@/entities/attachment'
import { fetchAttachment } from '@/shared/api/queries'
import { downloadBlob } from '@/shared/lib/download'

export const fileIcon = (name: string): LucideIcon =>
  fileFormat(name)?.label === 'Excel' ? FileSpreadsheet : FileText

/** «PDF · 1,2 МБ» */
export const fileMeta = (a: Pick<Attachment, 'fileName' | 'size'>) =>
  [fileFormat(a.fileName)?.label, formatSize(a.size)].filter(Boolean).join(' · ')

/**
 * Downloads go through fetch, not a plain link: the request carries the
 * session the way every API call does, and on mocks the worker answers it.
 */
export async function saveAttachment(a: Attachment) {
  downloadBlob(a.fileName, await fetchAttachment(a))
}
