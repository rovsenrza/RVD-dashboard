import { useRef } from 'react'
import { Button, type ButtonProps } from './Button'

/**
 * A Button that opens the system file picker. The input stays hidden and is
 * reset after every pick, so choosing the same file again still fires.
 */
export function FileButton({
  accept,
  onFile,
  ...button
}: Omit<ButtonProps, 'onClick' | 'type'> & { accept?: string; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button {...button} onClick={() => input.current?.click()} />
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </>
  )
}
