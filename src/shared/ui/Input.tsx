import type { ComponentProps, ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type InputProps = ComponentProps<'input'>

export function Input({ className, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg bg-sheet px-3 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow duration-150 outline-none placeholder:text-ink-faint hover:shadow-[inset_0_0_0_1px_var(--color-ink-faint)] focus:shadow-[inset_0_0_0_2px_var(--color-brand)]',
        className,
      )}
      {...rest}
    />
  )
}

/** Text input with a leading search icon and optional trailing hint (e.g. a shortcut). */
export function SearchInput({ className, hint, ...rest }: InputProps & { hint?: ReactNode }) {
  return (
    <label className={cn('relative block rounded-lg bg-sheet', className)}>
      <Search
        size={15}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
      />
      <Input type="search" className={cn('bg-transparent pl-9', hint && 'pr-14')} {...rest} />
      {hint && (
        <span className="pointer-events-none absolute top-1/2 right-2.5 z-10 -translate-y-1/2">
          {hint}
        </span>
      )}
    </label>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 items-center rounded-md bg-field px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-muted shadow-[inset_0_0_0_1px_var(--color-line)]">
      {children}
    </kbd>
  )
}
