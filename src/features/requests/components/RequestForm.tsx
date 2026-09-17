import { useState, type FormEvent } from 'react'
import { useSession } from '@/app/session'
import { REQUEST_KIND_LABEL } from '@/entities/request'
import { useCatalogNumbers, useCreateRequest, useEquipment } from '@/shared/api/queries'
import { Button, Dialog, Field, Input, Select, useToast } from '@/shared/ui'

const NO_EQUIPMENT = ''

export function RequestForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const catalog = useCatalogNumbers()
  const equipment = useEquipment()
  const create = useCreateRequest()
  const toast = useToast()
  const { branch, branches } = useSession()

  const [kind, setKind] = useState<'replace' | 'manufacture'>('replace')
  const [catalogNumberId, setCatalogNumberId] = useState('')
  const [equipmentId, setEquipmentId] = useState(NO_EQUIPMENT)
  const [quantity, setQuantity] = useState(1)
  const [comment, setComment] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const cat = catalog.data?.find((c) => c.id === catalogNumberId)
    const eq = equipment.data?.find((x) => x.id === equipmentId)
    create.mutate(
      {
        // The chosen equipment decides the branch; without one the request
        // belongs to the branch currently in scope.
        branchId: eq?.branchId ?? branch?.id ?? branches[0].id,
        productId: null,
        kind,
        quantity,
        comment: comment.trim() || null,
        positions: [
          {
            catalogNumberId: cat?.id ?? null,
            catalogNumber: cat?.name ?? null,
            equipmentId: eq?.id ?? null,
            quantity,
          },
        ],
      },
      {
        onSuccess: (created) => {
          toast(`Заявка ${created.number} создана`)
          onClose()
        },
        onError: () => toast('Не удалось создать заявку', 'error'),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Новая заявка"
      description="Заявка уйдёт в 1С как заказ клиента."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" type="submit" form="request-form" disabled={create.isPending}>
            {create.isPending ? 'Отправляем…' : 'Создать заявку'}
          </Button>
        </>
      }
    >
      <form id="request-form" onSubmit={submit} className="grid gap-4">
        <Field label="Тип заявки">
          {(id) => (
            <Select
              id={id}
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              options={Object.entries(REQUEST_KIND_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          )}
        </Field>

        <Field label="Каталожный номер" hint="Определяет состав и сроки изделия">
          {(id) => (
            <Select
              id={id}
              required
              value={catalogNumberId}
              onChange={(e) => setCatalogNumberId(e.target.value)}
              placeholder="Выберите номер"
              options={(catalog.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
        </Field>

        <Field label="Техника" hint="Можно оставить без привязки к технике">
          {(id) => (
            <Select
              id={id}
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              placeholder="Без привязки к технике"
              options={(equipment.data ?? []).map((e) => ({
                value: e.id,
                label: `${e.garageNumber} · ${e.brand} ${e.model}`,
              }))}
            />
          )}
        </Field>

        <Field label="Количество">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          )}
        </Field>

        <Field label="Комментарий">
          {(id) => (
            <Input
              id={id}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Например: срочно, простой техники"
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
