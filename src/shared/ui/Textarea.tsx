import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

/** Multi-line Input: same ring, focus and touch sizing; grows by hand, never sideways. */
export function Textarea({ className, rows = 3, ...rest }: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'block w-full resize-y rounded-lg bg-sheet px-3 py-2 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow duration-150 outline-none placeholder:text-ink-faint hover:shadow-[inset_0_0_0_1px_var(--color-ink-faint)] focus:shadow-[inset_0_0_0_2px_var(--color-brand)] pointer-coarse:text-base',
        className,
      )}
      {...rest}
    />
  )
}
