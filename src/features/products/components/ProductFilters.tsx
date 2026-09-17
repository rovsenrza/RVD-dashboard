import { useEffect, useState, type FormEvent } from 'react'
import type { URLSearchParamsInit } from 'react-router-dom'
import { LIFECYCLE_LABEL, LIFECYCLE_ORDER, STATUS_LABEL, STATUS_ORDER } from '@/entities/product'
import { useCatalogNumbers, useEquipment } from '@/shared/api/queries'
import { Button, Dialog, Field, Select } from '@/shared/ui'
import type { FilterKey, FilterValues } from '../filters'

export function ProductFilters({
  open,
  onClose,
  values,
  onApply,
}: {
  open: boolean
  onClose: () => void
  values: FilterValues
  onApply: (next: URLSearchParamsInit) => void
}) {
  const equipment = useEquipment()
  const catalog = useCatalogNumbers()
  const [draft, setDraft] = useState<FilterValues>(values)

  // Reopening after an outside change (a status chip removed, say) must not
  // resurrect the stale draft.
  useEffect(() => {
    if (open) setDraft(values)
  }, [open, values])

  const set = (key: FilterKey, value: string) => setDraft((d) => ({ ...d, [key]: value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onApply(Object.entries(draft).filter(([, v]) => v) as [string, string][])
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Фильтры"
      description="Сузить реестр изделий"
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onApply([])
              onClose()
            }}
          >
            Сбросить
          </Button>
          <Button size="sm" type="submit" form="product-filters">
            Применить
          </Button>
        </>
      }
    >
      <form id="product-filters" onSubmit={submit} className="grid gap-4">
        <Field label="Состояние ресурса">
          {(id) => (
            <Select
              id={id}
              value={draft.status ?? ''}
              onChange={(e) => set('status', e.target.value)}
              placeholder="Любое"
              options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          )}
        </Field>

        <Field label="Статус в 1С">
          {(id) => (
            <Select
              id={id}
              value={draft.lifecycle ?? ''}
              onChange={(e) => set('lifecycle', e.target.value)}
              placeholder="Любой"
              options={LIFECYCLE_ORDER.map((l) => ({ value: l, label: LIFECYCLE_LABEL[l] }))}
            />
          )}
        </Field>

        <Field label="Установка">
          {(id) => (
            <Select
              id={id}
              value={draft.installed ?? ''}
              onChange={(e) => set('installed', e.target.value)}
              placeholder="Любая"
              options={[
                { value: '1', label: 'Установлены на технику' },
                { value: '0', label: 'Не установлены' },
              ]}
            />
          )}
        </Field>

        <Field label="Техника">
          {(id) => (
            <Select
              id={id}
              value={draft.equipment ?? ''}
              onChange={(e) => set('equipment', e.target.value)}
              placeholder="Любая"
              options={(equipment.data ?? []).map((e) => ({
                value: e.id,
                label: `${e.garageNumber} · ${e.brand} ${e.model}`,
              }))}
            />
          )}
        </Field>

        <Field label="Каталожный номер">
          {(id) => (
            <Select
              id={id}
              value={draft.catalog ?? ''}
              onChange={(e) => set('catalog', e.target.value)}
              placeholder="Любой"
              options={(catalog.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
