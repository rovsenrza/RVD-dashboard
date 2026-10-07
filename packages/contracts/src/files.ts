import type { Attachment } from './types'

/**
 * Upload limits (Д25). The API enforces the same numbers; the forms check
 * first so nobody waits for a file to travel only to be refused.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Per hose, request or replacement. */
export const MAX_FILES = 20

export interface FileFormat {
  mime: string
  kind: Attachment['kind']
  label: string
}

const photo = (mime: string, label: string): FileFormat => ({ mime, kind: 'photo', label })
const doc = (mime: string, label: string): FileFormat => ({ mime, kind: 'document', label })

/**
 * Formats are decided by extension: browsers leave the MIME type empty for
 * Office files on some systems. The API checks the file's own signature too (`signatureMatches`).
 */
const FORMATS: Record<string, FileFormat> = {
  jpg: photo('image/jpeg', 'JPG'),
  jpeg: photo('image/jpeg', 'JPG'),
  png: photo('image/png', 'PNG'),
  webp: photo('image/webp', 'WebP'),
  pdf: doc('application/pdf', 'PDF'),
  doc: doc('application/msword', 'Word'),
  docx: doc('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Word'),
  xls: doc('application/vnd.ms-excel', 'Excel'),
  xlsx: doc('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Excel'),
}

export const fileFormat = (name: string): FileFormat | null => {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? null : (FORMATS[name.slice(dot + 1).toLowerCase()] ?? null)
}

/** The `accept` list for the file picker. */
export const ACCEPT_FILES = Object.keys(FORMATS)
  .map((ext) => `.${ext}`)
  .join(',')

export const LIMITS_HINT = `JPG, PNG, WebP, PDF, Word, Excel · до ${MAX_FILE_BYTES / 1024 / 1024} МБ каждый`

/** «840 КБ», «2,4 МБ». */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`
}

/** Why this file cannot be attached, in the customer's words — or null when it can. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (!fileFormat(file.name))
    return `«${file.name}»: такой формат не принимаем — нужны фото JPG, PNG, WebP или документ PDF, Word, Excel`
  if (file.size === 0) return `«${file.name}»: файл пустой`
  if (file.size > MAX_FILE_BYTES)
    return `«${file.name}»: ${formatSize(file.size)} — больше ${formatSize(MAX_FILE_BYTES)}`
  return null
}

export const tooManyFiles = (name: string) =>
  `«${name}»: к одной записи можно приложить не больше ${MAX_FILES} файлов`

/** The first bytes each format starts with; a renamed executable or a mislabelled file fails here. */
const SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  // Word 97–2003 and Excel 97–2003: an OLE compound file.
  'application/msword': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  'application/vnd.ms-excel': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  // .docx and .xlsx are zip archives.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4b, 0x03, 0x04],
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4b, 0x03, 0x04]],
}

/** Whether the bytes are what the extension says (WebP: «RIFF» … «WEBP»). */
export function signatureMatches(format: FileFormat, bytes: Uint8Array): boolean {
  if (format.mime === 'image/webp')
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    )
  return (SIGNATURES[format.mime] ?? []).some((sig) => sig.every((b, i) => bytes[i] === b))
}
