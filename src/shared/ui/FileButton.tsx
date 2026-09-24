import { useRef } from 'react'
import { Button, type ButtonProps } from './Button'

type Picked =
  | { multiple?: false; onFile: (file: File) => void; onFiles?: never }
  | { multiple: true; onFiles: (files: File[]) => void; onFile?: never }

/**
 * A Button that opens the system file picker. The input stays hidden and is
 * reset after every pick, so choosing the same file again still fires.
 */
export function FileButton({
  accept,
  multiple,
  onFile,
  onFiles,
  ...button
}: Omit<ButtonProps, 'onClick' | 'type'> & { accept?: string } & Picked) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button {...button} onClick={() => input.current?.click()} />
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (!files.length) return
          if (onFiles) onFiles(files)
          else onFile?.(files[0])
        }}
      />
    </>
  )
}
