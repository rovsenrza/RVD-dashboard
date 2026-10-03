import { useId, useMemo, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Product } from '@/entities/types'
import { useFindProducts, useProductSearch } from '@/shared/api/queries'
import { useDebounced } from '@/shared/lib/useDebounced'
import { cn } from '@/shared/lib/utils'
import { Button, Input } from '@/shared/ui'
import { findProduct, lookupText } from '../productLookup'

/** Suggestions per lookup; a few more characters narrow them. */
const SUGGESTIONS = 20
const anyHose = () => true

/**
 * A field that turns into a hose: pick a suggestion («EHS · каталожный № ·
 * гаражный №»), or type an EHS or internal number and leave the field or press
 * Enter. The server finds the suggestions as the person types — before that,
 * the hoses of `near`, the machine the form is about — so a client with tens
 * of thousands of hoses picks as fast as one with a hundred. Only hoses that
 * pass `eligible` are offered or taken; a value that names none is reported
 * through `onMiss`, for the surrounding `Field` to show.
 */
export function ProductPicker({
  id,
  labelOf,
  eligible = anyHose,
  near,
  order,
  taken,
  onPick,
  onMiss,
  disabled,
  required,
  invalid,
  placeholder = 'EHS, ваш номер или выберите из подсказки',
}: {
  id: string
  labelOf: (p: Product) => string
  /** The form's rule for which hoses may be picked */
  eligible?: (p: Product) => boolean
  /** A machine whose hoses are suggested before anything is typed */
  near?: string
  /** How the suggestions line up, e.g. the most urgent first */
  order?: (a: Product, b: Product) => number
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
  const text = lookupText(useDebounced(typed))
  const search = useProductSearch(
    text.length >= 2
      ? { q: text, limit: SUGGESTIONS }
      : { equipment: near, archive: '0', limit: SUGGESTIONS },
  )
  const find = useFindProducts()

  const suggestions = useMemo(() => {
    const list = (search.data ?? []).filter((p) => eligible(p) && !taken?.has(p.id))
    return order ? list.sort(order) : list
  }, [search.data, eligible, taken, order])

  const take = async (value: string) => {
    const wanted = lookupText(value)
    if (!wanted) return
    // What was typed may be newer than the suggestions: ask the server for exactly this.
    const hit =
      findProduct(suggestions, value, labelOf) ??
      findProduct(await find({ q: wanted, limit: 50 }), value, labelOf)
    if (!hit) return onMiss('Такого изделия нет среди ваших')
    if (taken?.has(hit.id)) return onMiss(`EHS ${hit.serialNumber} уже выбрано`)
    if (!eligible(hit)) return onMiss(`EHS ${hit.serialNumber} сюда не подходит`)
    onPick(hit)
    setTyped('')
    onMiss(undefined)
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
          if (suggestions.some((p) => labelOf(p) === value)) return void take(value)
          setTyped(value)
          onMiss(undefined)
        }}
        onBlur={() => void take(typed)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          void take(typed)
        }}
      />
      <datalist id={listId}>
        {suggestions.map((p) => (
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
