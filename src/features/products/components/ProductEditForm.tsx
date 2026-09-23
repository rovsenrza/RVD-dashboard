import { useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import type { Product } from '@/entities/types'
import { INSTALL_PLACES } from '@/entities/product'
import { useEquipment, useUpdateProduct } from '@/shared/api/queries'
import { Button, DatePicker, Dialog, Field, Input, Select, useToast } from '@/shared/ui'

/** Mounted only while open, so every opening reads the product afresh. */
export function ProductEditForm({
  product: p,
  onClose,
}: {
  product: Product
  onClose: () => void
}) {
  const equipment = useEquipment()
  const update = useUpdateProduct(p.id)
  const toast = useToast()

  const [equipmentId, setEquipmentId] = useState(p.equipmentId ?? '')
  const [installPlace, setInstallPlace] = useState(p.installPlace ?? '')
  const [installedAt, setInstalledAt] = useState(p.installedAt ?? '')
  const [clientNumber, setClientNumber] = useState(p.clientNumber ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update.mutate(
      {
        equipmentId: equipmentId || null,
        installPlace: equipmentId ? installPlace || null : null,
        installedAt: equipmentId ? installedAt || null : null,
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

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Изделие ${p.serialNumber}`}
      description="Факт установки и ваш внутренний номер. Сроки и состав приходят из 1С."
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
          <>
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

            <Field label="Дата установки" hint="От неё считается остаток ресурса">
              {(id) => (
                <DatePicker
                  id={id}
                  required
                  value={installedAt}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={setInstalledAt}
                />
              )}
            </Field>
          </>
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
