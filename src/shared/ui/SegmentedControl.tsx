import { useRef, type KeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Tooltip } from './Tooltip'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** When set, the segment shows only the icon; the label stays for screen readers and the tooltip. */
  icon?: LucideIcon
}

/** A radio group drawn as a track with one raised segment. Arrow keys move the choice. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    e.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex gap-0.5 rounded-lg bg-field p-0.5', className)}
    >
      {options.map((o, i) => {
        const checked = o.value === value
        const segment = (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'grid h-7 min-w-8 place-items-center rounded-md px-2 text-label transition-colors duration-100',
              checked ? 'bg-pop text-ink shadow-sheet' : 'text-ink-muted hover:text-ink',
            )}
          >
            {o.icon ? (
              <>
                <o.icon size={15} strokeWidth={1.75} aria-hidden />
                <span className="sr-only">{o.label}</span>
              </>
            ) : (
              o.label
            )}
          </button>
        )
        return o.icon ? (
          <Tooltip key={o.value} content={o.label}>
            {segment}
          </Tooltip>
        ) : (
          segment
        )
      })}
    </div>
  )
}
