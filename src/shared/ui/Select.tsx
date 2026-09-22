import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

/** Native select styled as the Input twin, so forms keep one field silhouette. */
export function Select({
  options,
  placeholder,
  className,
  ...rest
}: ComponentProps<'select'> & { options: SelectOption[]; placeholder?: string }) {
  return (
    <div className={cn('relative', className)}>
      <select
        className="h-9 w-full pointer-coarse:h-11 pointer-coarse:text-base appearance-none rounded-lg bg-sheet pr-9 pl-3 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow duration-150 outline-none hover:shadow-[inset_0_0_0_1px_var(--color-ink-faint)] focus:shadow-[inset_0_0_0_2px_var(--color-brand)] aria-invalid:not-focus:shadow-[inset_0_0_0_1px_var(--color-status-replace-ink)]"
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
}
