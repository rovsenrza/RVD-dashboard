import { useMemo, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import type { Product, Replacement } from '@/entities/types'
import { REPLACEMENT_REASONS, USAGE_UNIT_LABEL } from '@/entities/replacement'
import { ApiError } from '@/shared/api/client'
import {
  useCreateReplacement,
  useEquipment,
  useEquipmentProducts,
  useProducts,
} from '@/shared/api/queries'
import {
  Button,
  DatePicker,
  Dialog,
  Field,
  Input,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
} from '@/shared/ui'

const onMachine = (p: Product) => p.installedAt !== null && p.lifecycle !== 'written_off'
const inStock = (p: Product) => p.installedAt === null && p.lifecycle !== 'written_off'

/**
 * «Зафиксировать замену»: which hose came off which machine, what went on
 * in its place, when, why and at what usage. Opened from a hose, a machine
 * or the journal — whatever is already known arrives preset and locked.
 */
export function ReplacementDialog({
  product,
  equipmentId: presetMachine,
  onClose,
}: {
  product?: Product
  equipmentId?: string
  onClose: () => void
}) {
  const toast = useToast()
  const create = useCreateReplacement()
  const machines = useEquipment()
  const stock = useProducts()
  const [machineId, setMachineId] = useState(product?.equipmentId ?? presetMachine ?? '')
  const onThisMachine = useEquipmentProducts(machineId)
  const [oldId, setOldId] = useState(product?.id ?? '')
  const [newId, setNewId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [reason, setReason] = useState('')
  const [usage, setUsage] = useState('')
  const [unit, setUnit] = useState<Replacement['usageUnit']>('hours')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string>()

  const oldHoses = (onThisMachine.data ?? []).filter(onMachine)
  const old = oldHoses.find((p) => p.id === oldId) ?? product

  // Hoses the customer holds but has not installed; the same catalogue number first.
  const spares = useMemo(
    () =>
      (stock.data ?? [])
        .filter(inStock)
        .sort(
          (a, b) =>
            Number(b.catalogNumberId === old?.catalogNumberId) -
              Number(a.catalogNumberId === old?.catalogNumberId) ||
            a.serialNumber.localeCompare(b.serialNumber),
        ),
    [stock.data, old?.catalogNumberId],
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(undefined)
    create.mutate(
      {
        oldProductId: oldId,
        newProductId: newId || null,
        date,
        reason,
        operatingHours: usage ? Number(usage) : null,
        usageUnit: unit,
        comment: comment.trim() || null,
      },
      {
        onSuccess: (r) => {
          toast(
            r.newSerialNumber
              ? `Замена зафиксирована: EHS ${r.oldSerialNumber} → EHS ${r.newSerialNumber}`
              : `Замена зафиксирована: EHS ${r.oldSerialNumber} снято`,
          )
          onClose()
        },
        onError: (err) =>
          err instanceof ApiError && err.status === 409
            ? setError(err.message)
            : toast('Не удалось сохранить замену, попробуйте ещё раз', 'error'),
      },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Зафиксировать замену"
      description="Уйдёт в 1С: снятое изделие спишется, новое встанет на его место с даты замены."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" type="submit" form="replacement-form" disabled={create.isPending}>
            {create.isPending ? 'Сохраняем…' : 'Зафиксировать'}
          </Button>
        </>
      }
    >
      <form id="replacement-form" onSubmit={submit} className="grid gap-4">
        <Field label="Техника">
          {(id) => (
            <Select
              id={id}
              required
              value={machineId}
              disabled={!!product || !!presetMachine}
              placeholder="Выберите технику"
              onChange={(e) => {
                setMachineId(e.target.value)
                setOldId('')
              }}
              options={(machines.data ?? []).map((m) => ({
                value: m.id,
                label: `${m.garageNumber} · ${m.brand} ${m.model}`,
              }))}
            />
          )}
        </Field>

        <Field label="Снятое изделие">
          {(id) => (
            <Select
              id={id}
              required
              value={oldId}
              disabled={!!product || !machineId}
              placeholder={machineId ? 'Какой РВД сняли' : 'Сначала выберите технику'}
              onChange={(e) => setOldId(e.target.value)}
              options={(product ? [product] : oldHoses).map((p) => ({
                value: p.id,
                label: `EHS ${p.serialNumber} · ${p.installPlace ?? 'место не указано'} · ${p.type}`,
              }))}
            />
          )}
        </Field>

        <Field
          label="Установленное изделие"
          hint="Изделия, которые числятся у вас и ещё не установлены; того же каталожного номера — первыми. Если нового нет в списке, оставьте пустым — 1С добавит его при синхронизации."
          error={error}
        >
          {(id) => (
            <Select
              id={id}
              value={newId}
              placeholder="Не из кабинета / укажу позже"
              onChange={(e) => {
                setNewId(e.target.value)
                setError(undefined)
              }}
              options={spares.map((p) => ({
                value: p.id,
                label: `EHS ${p.serialNumber} · ${p.catalogNumber}${p.catalogNumberId === old?.catalogNumberId ? ' · тот же номер' : ''}`,
              }))}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Дата замены">
            {(id) => (
              <DatePicker
                id={id}
                required
                value={date}
                min={old?.installedAt ?? undefined}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={setDate}
              />
            )}
          </Field>
          <Field label="Причина">
            {(id) => (
              <Select
                id={id}
                required
                value={reason}
                placeholder="Выберите причину"
                onChange={(e) => setReason(e.target.value)}
                options={REPLACEMENT_REASONS.map((r) => ({ value: r, label: r }))}
              />
            )}
          </Field>
        </div>

        <Field label="Наработка на момент замены" hint="По счётчику техники; можно не указывать">
          {(id) => (
            <div className="flex items-center gap-2">
              <Input
                id={id}
                inputMode="numeric"
                value={usage}
                onChange={(e) => setUsage(e.target.value.replace(/\D/g, '').slice(0, 7))}
                className="w-36 tabular"
              />
              <SegmentedControl
                label="Единица наработки"
                value={unit}
                onChange={setUnit}
                options={(['hours', 'km'] as const).map((u) => ({
                  value: u,
                  label: USAGE_UNIT_LABEL[u],
                }))}
              />
            </div>
          )}
        </Field>

        <Field label="Комментарий">
          {(id) => (
            <Textarea
              id={id}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Что случилось, что заметили при замене"
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
