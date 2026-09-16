import type { InputHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/70 outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/40',
        className,
      )}
      {...rest}
    />
  )
}

/** Text input with a leading search icon. Controlled: pass value + onChange. */
export function SearchInput({ className, ...rest }: InputProps) {
  return (
    <label className={cn('relative block', className)}>
      <Search
        size={14}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted"
      />
      <Input type="search" className="pl-8" {...rest} />
    </label>
  )
}
