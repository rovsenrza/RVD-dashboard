import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * Native checkbox (keyboard, forms and screen readers work unchanged) drawn
 * as an inset-ring box that fills amber when checked. The whole row — box,
 * label and hint — is the hit area. `hideLabel` keeps the label for screen
 * readers only (a box in a table row); `indeterminate` draws a dash for
 * «some of these».
 */
export function Checkbox({
  label,
  hint,
  hideLabel = false,
  indeterminate = false,
  className,
  ...rest
}: Omit<ComponentProps<'input'>, 'type'> & {
  label: ReactNode
  hint?: ReactNode
  hideLabel?: boolean
  indeterminate?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  const Mark = indeterminate ? Minus : Check
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 text-sm has-disabled:cursor-default has-disabled:opacity-55',
        className,
      )}
    >
      <input ref={ref} type="checkbox" className="peer sr-only" {...rest} />
      <span
        aria-hidden
        className="mt-px grid size-4.5 shrink-0 place-items-center rounded-[5px] bg-sheet text-on-brand shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-colors duration-100 peer-checked:bg-brand peer-checked:shadow-none peer-indeterminate:bg-brand peer-indeterminate:shadow-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand pointer-coarse:size-5.5 peer-checked:[&_svg]:opacity-100 peer-indeterminate:[&_svg]:opacity-100"
      >
        <Mark size={12} strokeWidth={3} className="opacity-0" />
      </span>
      <span className={hideLabel ? 'sr-only' : 'min-w-0'}>
        <span className="block">{label}</span>
        {hint && <span className="mt-0.5 block text-label text-ink-muted">{hint}</span>}
      </span>
    </label>
  )
}
