import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { format, isValid, parse, parseISO } from 'date-fns'
import { cn } from '@/shared/lib/utils'
import { Input } from './Input'

const DISPLAY = 'dd.MM.yyyy'

const toText = (iso: string) => (iso ? format(parseISO(iso), DISPLAY) : '')

/** Keeps digits only and re-inserts the dots, so «25092026» and «25.09.2026» type the same. */
function mask(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return toText(raw.trim()) // pasted ISO
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('.')
}

/** ISO date for a complete, real calendar date; null otherwise (31.02 is rejected). */
function toIso(text: string): string | null {
  if (text.length !== DISPLAY.length) return null
  const date = parse(text, DISPLAY, new Date())
  return isValid(date) && format(date, DISPLAY) === text ? format(date, 'yyyy-MM-dd') : null
}

function problem(text: string, min?: string, max?: string): string {
  if (!text) return ''
  const iso = toIso(text)
  if (!iso) return 'Введите дату в формате дд.мм.гггг'
  if (min && iso < min) return `Дата не может быть раньше ${toText(min)}`
  if (max && iso > max) return `Дата не может быть позже ${toText(max)}`
  return ''
}

/**
 * Date field that always reads dd.MM.yyyy, whatever the browser locale. Type
 * the digits (dots are added) or pick from the native calendar. `value` and
 * `onChange` speak ISO (yyyy-MM-dd, '' when empty); an incomplete or
 * out-of-range entry is reported through native form validation.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  className,
}: {
  id?: string
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
  className?: string
}) {
  const field = useRef<HTMLInputElement>(null)
  const native = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(() => toText(value))
  const [synced, setSynced] = useState(value)
  const [touched, setTouched] = useState(false)

  // A new value from outside (reset, picked elsewhere) replaces whatever is typed.
  if (value !== synced) {
    setSynced(value)
    setText(toText(value))
  }

  useEffect(() => {
    field.current?.setCustomValidity(problem(text, min, max))
  }, [text, min, max])

  const emit = (iso: string) => {
    setSynced(iso)
    onChange(iso)
  }

  const onType = (raw: string) => {
    const next = mask(raw)
    setText(next)
    const iso = toIso(next)
    if (!next) emit('')
    else if (iso && !problem(next, min, max)) emit(iso)
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={field}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="дд.мм.гггг"
        value={text}
        required={required}
        disabled={disabled}
        onChange={(e) => onType(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={(touched && !!problem(text, min, max)) || undefined}
        className="pr-10 tabular"
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Выбрать дату в календаре"
        onClick={() => {
          const input = native.current
          if (!input) return
          try {
            input.showPicker()
          } catch {
            input.focus()
          }
        }}
        className="absolute top-1/2 right-1 grid size-7 pointer-coarse:size-9 -translate-y-1/2 place-items-center rounded-md text-ink-muted transition-colors duration-100 hover:bg-wash hover:text-ink disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarDays size={15} strokeWidth={1.75} />
      </button>
      {/* The native picker anchors to this invisible input under the field. */}
      <input
        ref={native}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={toIso(text) ?? ''}
        min={min}
        max={max}
        onChange={(e) => {
          setText(toText(e.target.value))
          emit(e.target.value)
        }}
        className="pointer-events-none absolute bottom-0 left-0 h-0 w-full opacity-0"
      />
    </div>
  )
}
