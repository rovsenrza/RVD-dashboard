import type { Attachment } from '@/entities/types'

/**
 * Upload limits (Д25). The BFF enforces the same numbers; the forms check
 * first so nobody waits for a file to travel only to be refused.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Per hose, request or replacement. */
export const MAX_FILES = 20

interface FileFormat {
  mime: string
  kind: Attachment['kind']
  label: string
}

const photo = (mime: string, label: string): FileFormat => ({ mime, kind: 'photo', label })
const doc = (mime: string, label: string): FileFormat => ({ mime, kind: 'document', label })

/**
 * Formats are decided by extension: browsers leave the MIME type empty for
 * Office files on some systems. The BFF checks the file's own signature too.
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
