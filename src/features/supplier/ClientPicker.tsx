import { useState } from 'react'
import type { OnecClient } from '@/entities/types'
import { Checkbox, EmptyState, SearchInput } from '@/shared/ui'

/**
 * The 1С clients not yet in the cabinet, to tick: by name or INN. Several ticked become
 * the company's branches; `single` keeps one at a time (adding a branch).
 */
export function ClientPicker({
  clients,
  value,
  onChange,
  single = false,
}: {
  clients: OnecClient[]
  value: string[]
  onChange: (ids: string[]) => void
  single?: boolean
}) {
  const [q, setQ] = useState('')
  const free = clients.filter((c) => !c.companyId)
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? free.filter((c) => c.name.toLowerCase().includes(needle) || c.inn?.includes(needle))
    : free
  const toggle = (id: string, on: boolean) =>
    onChange(single ? (on ? [id] : []) : on ? [...value, id] : value.filter((v) => v !== id))

  return (
    <div className="grid gap-2">
      <SearchInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Название или ИНН"
        aria-label="Поиск клиента 1С"
      />
      <div className="max-h-64 overflow-y-auto rounded-lg bg-field px-3 py-1.5">
        {shown.length ? (
          <ul className="divide-y divide-line">
            {shown.map((c) => (
              <li key={c.id} className="py-2">
                <Checkbox
                  label={c.name}
                  hint={c.inn ? `ИНН ${c.inn}` : undefined}
                  checked={value.includes(c.id)}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            inset
            title={free.length ? 'Никого не нашли' : 'Все клиенты 1С уже в кабинете'}
            description={
              free.length
                ? 'Проверьте название или ИНН'
                : 'Новый клиент появится здесь после ночной синхронизации с 1С'
            }
          />
        )}
      </div>
    </div>
  )
}
