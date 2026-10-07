import { useId, useState, type FormEvent } from 'react'
import type { Equipment } from '@/entities/types'
import { useEquipment, useUpdateEquipment } from '@/shared/api/queries'
import { Button, Dialog, Field, Input, useToast } from '@/shared/ui'

/**
 * What the company records about a machine that 1С does not keep: the
 * department the «по подразделениям» view groups it under, and its factory
 * number. Garage number, make and owner stay the supplier's.
 */
export function EquipmentEditForm({
  machine: e,
  onClose,
}: {
  machine: Equipment
  onClose: () => void
}) {
  const update = useUpdateEquipment(e.id)
  const fleet = useEquipment()
  const toast = useToast()
  const suggestions = useId()
  const [department, setDepartment] = useState(e.department ?? '')
  const [factoryNumber, setFactoryNumber] = useState(e.factoryNumber ?? '')
  // The departments already named, so one department is written one way.
  const known = [
    ...new Set((fleet.data ?? []).flatMap((m) => (m.department ? [m.department] : []))),
  ].sort((a, b) => a.localeCompare(b, 'ru'))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    update.mutate(
      { department: department.trim() || null, factoryNumber: factoryNumber.trim() || null },
      {
        onSuccess: () => {
          toast('Изменения сохранены')
          onClose()
        },
        onError: (error) => toast(error.message || 'Не удалось сохранить', 'error'),
      },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Техника ${e.garageNumber}`}
      description="Подразделение и заводской номер. Гаражный номер, марку и владельца ведёт поставщик в 1С."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" type="submit" form="equipment-edit" disabled={update.isPending}>
            {update.isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </>
      }
    >
      <form id="equipment-edit" onSubmit={submit} className="grid gap-4">
        <Field label="Подразделение" hint="По нему техника группируется в виде «По подразделениям»">
          {(id) => (
            <>
              <Input
                id={id}
                list={suggestions}
                value={department}
                onChange={(ev) => setDepartment(ev.target.value)}
                placeholder="Например: Карьер № 2"
              />
              <datalist id={suggestions}>
                {known.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Заводской номер">
          {(id) => (
            <Input
              id={id}
              value={factoryNumber}
              onChange={(ev) => setFactoryNumber(ev.target.value)}
              placeholder="С таблички на технике"
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
