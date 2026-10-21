import { FileSpreadsheet, FileText, type LucideProps } from 'lucide-react'
import { fileFormat } from '@/entities/attachment'

/** The document glyph for a file name, as an element. */
export function FileGlyph({ name, ...props }: { name: string } & LucideProps) {
  return fileFormat(name)?.label === 'Excel' ? (
    <FileSpreadsheet {...props} />
  ) : (
    <FileText {...props} />
  )
}
