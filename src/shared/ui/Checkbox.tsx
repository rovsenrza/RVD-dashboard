import type { ComponentProps, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * Native checkbox (keyboard, forms and screen readers work unchanged) drawn
 * as an inset-ring box that fills amber when checked. The whole row — box,
 * label and hint — is the hit area.
 */
export function Checkbox({
  label,
  hint,
  className,
  ...rest
}: Omit<ComponentProps<'input'>, 'type'> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 text-sm has-disabled:cursor-default has-disabled:opacity-55',
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...rest} />
      <span
        aria-hidden
        className="mt-px grid size-4.5 shrink-0 place-items-center rounded-[5px] bg-sheet text-on-brand shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-colors duration-100 peer-checked:bg-brand peer-checked:shadow-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand pointer-coarse:size-5.5 peer-checked:[&_svg]:opacity-100"
      >
        <Check size={12} strokeWidth={3} className="opacity-0" />
      </span>
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="mt-0.5 block text-label text-ink-muted">{hint}</span>}
      </span>
    </label>
  )
}
