import { useId, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Product } from '@/entities/types'
import { cn } from '@/shared/lib/utils'
import { Button, Input } from '@/shared/ui'
import { findProduct } from '../productLookup'

/**
 * A field that turns into a hose: pick a suggestion («EHS · каталожный № ·
 * гаражный №»), or type an EHS or internal number and leave the field or press
 * Enter. Whatever does not name one of `candidates` exactly is reported through
 * `onMiss`, for the surrounding `Field` to show.
 */
export function ProductPicker({
  id,
  candidates,
  labelOf,
  taken,
  onPick,
  onMiss,
  disabled,
  required,
  invalid,
  placeholder = 'EHS, ваш номер или выберите из подсказки',
}: {
  id: string
  candidates: Product[]
  labelOf: (p: Product) => string
  /** Already chosen: left out of the suggestions, refused when typed */
  taken?: ReadonlySet<string>
  onPick: (p: Product) => void
  onMiss: (message: string | undefined) => void
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  placeholder?: string
}) {
  const listId = useId()
  const [typed, setTyped] = useState('')

  const take = (value: string) => {
    const hit = findProduct(candidates, value, labelOf)
    if (hit && taken?.has(hit.id)) onMiss(`EHS ${hit.serialNumber} уже выбрано`)
    else if (hit) {
      onPick(hit)
      setTyped('')
      onMiss(undefined)
    } else if (value.trim()) onMiss('Такого изделия нет среди ваших')
  }

  return (
    <>
      <Input
        id={id}
        list={listId}
        value={typed}
        autoComplete="off"
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        onChange={(e) => {
          const value = e.target.value
          // A suggestion arrives whole; a bare number is read once the field is left.
          if (candidates.some((p) => labelOf(p) === value)) return take(value)
          setTyped(value)
          onMiss(undefined)
        }}
        onBlur={() => take(typed)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          take(typed)
        }}
      />
      <datalist id={listId}>
        {candidates
          .filter((p) => !taken?.has(p.id))
          .map((p) => (
            <option key={p.id} value={labelOf(p)} />
          ))}
      </datalist>
    </>
  )
}

/** A chosen hose on the `field` tint: its label, an optional status, and a way to drop it. */
export function ProductRow({
  label,
  aside,
  onRemove,
  removeLabel = 'Убрать изделие',
}: {
  label: string
  aside?: ReactNode
  onRemove?: () => void
  removeLabel?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-9 min-w-0 items-center justify-between gap-3 rounded-lg bg-field py-1 pl-3 text-sm',
        onRemove ? 'pr-1' : 'pr-3',
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {aside}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            icon={X}
            aria-label={removeLabel}
            onClick={onRemove}
          />
        )}
      </span>
    </div>
  )
}
