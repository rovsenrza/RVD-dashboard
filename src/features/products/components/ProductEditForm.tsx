import { useState, type FormEvent } from 'react'
import type { Product } from '@/entities/types'
import { INSTALL_PLACES } from '@/entities/product'
import { useEquipment, useUpdateProduct } from '@/shared/api/queries'
import { formatDate } from '@/shared/lib/utils'
import { Button, Dialog, Field, Input, Select, useToast } from '@/shared/ui'

/** Mounted only while open, so every opening reads the product afresh. */
export function ProductEditForm({
  product: p,
  onClose,
  onAskDate,
}: {
  product: Product
  onClose: () => void
  /** The date is the supplier's: this hands over to «Связаться со специалистом». */
  onAskDate: () => void
}) {
  const equipment = useEquipment()
  const update = useUpdateProduct(p.id)
  const toast = useToast()

  const [equipmentId, setEquipmentId] = useState(p.equipmentId ?? '')
  const [installPlace, setInstallPlace] = useState(p.installPlace ?? '')
  const [clientNumber, setClientNumber] = useState(p.clientNumber ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update.mutate(
      {
        equipmentId: equipmentId || null,
        installPlace: equipmentId ? installPlace || null : null,
        clientNumber: clientNumber.trim() || null,
      },
      {
        onSuccess: () => {
          toast('Изменения сохранены')
          onClose()
        },
        onError: () => toast('Не удалось сохранить', 'error'),
      },
    )
  }

  const date = p.installedAt
    ? formatDate(p.installedAt)
    : p.shippedAt && `${formatDate(p.shippedAt)}, по дате отгрузки`

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Изделие ${p.serialNumber}`}
      description="Техника, место установки и ваш внутренний номер. Даты, сроки и состав ведёт поставщик в 1С."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" type="submit" form="product-edit" disabled={update.isPending}>
            {update.isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </>
      }
    >
      <form id="product-edit" onSubmit={submit} className="grid gap-4">
        <Field label="Техника" hint="Снимите выбор, чтобы вернуть изделие на склад">
          {(id) => (
            <Select
              id={id}
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              placeholder="Не установлено"
              options={(equipment.data ?? []).map((e) => ({
                value: e.id,
                label: `${e.garageNumber} · ${e.brand} ${e.model}`,
              }))}
            />
          )}
        </Field>

        {equipmentId && (
          <Field label="Место установки">
            {(id) => (
              <Select
                id={id}
                value={installPlace}
                onChange={(e) => setInstallPlace(e.target.value)}
                placeholder="Не указано"
                options={INSTALL_PLACES.map((place) => ({ value: place, label: place }))}
              />
            )}
          </Field>
        )}

        {date && (
          <p className="text-label text-ink-muted">
            Дата установки — {date}. Её ведёт поставщик: если она неверна,{' '}
            <Button variant="link" size="inline" onClick={onAskDate}>
              попросите специалиста исправить
            </Button>
            .
          </p>
        )}

        <Field label="Внутренний номер" hint="Ваш собственный учётный номер">
          {(id) => (
            <Input
              id={id}
              value={clientNumber}
              onChange={(e) => setClientNumber(e.target.value)}
              placeholder="Например: K-1042"
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
