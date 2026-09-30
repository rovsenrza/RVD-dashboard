import { useState, type FormEvent } from 'react'
import { ClipboardPaste, Plus, X } from 'lucide-react'
import { useSession } from '@/app/session'
import { REQUEST_KIND_LABEL } from '@/entities/request'
import { useCatalogNumbers, useCreateRequest, useEquipment } from '@/shared/api/queries'
import { Button, Dialog, Field, Input, Select, Textarea, useToast } from '@/shared/ui'
import { AttachmentPicker } from '@/features/attachments/AttachmentPicker'
import { useUploads } from '@/features/attachments/useUploads'
import { parsePositions } from '../parsePositions'

const NO_EQUIPMENT = ''
const CATALOG_LIST = 'request-catalog-numbers'

let rowSeq = 0
const blank = (catalogNumber = '', quantity = 1): Row => ({
  key: ++rowSeq,
  catalogNumber,
  quantity,
})

interface Row {
  key: number
  catalogNumber: string
  quantity: number
}

export function RequestForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const catalog = useCatalogNumbers()
  const equipment = useEquipment()
  const create = useCreateRequest()
  const toast = useToast()
  const { branch, branches } = useSession()

  const [kind, setKind] = useState<'replace' | 'manufacture'>('replace')
  const [rows, setRows] = useState<Row[]>(() => [blank()])
  const [equipmentId, setEquipmentId] = useState(NO_EQUIPMENT)
  const [comment, setComment] = useState('')
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const uploads = useUploads()

  const patch = (key: number, part: Partial<Row>) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...part } : r)))

  /** Pasted lines land in the list; a still-empty first row makes room for them. */
  const addPasted = () => {
    const parsed = parsePositions(pasted)
    if (parsed.length === 0) return
    setRows((all) => [
      ...all.filter((r) => r.catalogNumber.trim() !== ''),
      ...parsed.map((p) => blank(p.catalogNumber, p.quantity)),
    ])
    setPasted('')
    setPasting(false)
  }

  const filled = rows.filter((r) => r.catalogNumber.trim() !== '')
  const total = filled.reduce((sum, r) => sum + r.quantity, 0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (filled.length === 0) return
    const eq = equipment.data?.find((x) => x.id === equipmentId)
    create.mutate(
      {
        // The chosen equipment decides the branch; without one the request
        // belongs to the branch currently in scope.
        branchId: eq?.branchId ?? branch?.id ?? branches[0].id,
        productId: null,
        kind,
        quantity: total,
        comment: comment.trim() || null,
        attachmentIds: uploads.ids,
        positions: filled.map((r) => {
          const typed = r.catalogNumber.trim()
          // A number typed by hand may be absent from the reference list; it goes as text.
          const known = catalog.data?.find((c) => c.name.toLowerCase() === typed.toLowerCase())
          return {
            catalogNumberId: known?.id ?? null,
            catalogNumber: known?.name ?? typed,
            equipmentId: eq?.id ?? null,
            quantity: r.quantity,
          }
        }),
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
          <Button
            size="sm"
            type="submit"
            form="request-form"
            disabled={create.isPending || uploads.busy || filled.length === 0}
          >
            {create.isPending
              ? 'Отправляем…'
              : uploads.busy
                ? 'Загружаем файлы…'
                : 'Создать заявку'}
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

        <fieldset className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <legend className="text-label font-medium text-ink">Каталожные номера</legend>
            <span className="text-label text-ink-muted">
              {filled.length > 0 ? `Позиций: ${filled.length} · штук: ${total}` : 'Введите номер'}
            </span>
          </div>
          <p className="text-label text-ink-muted">
            Впишите номер вручную или выберите из подсказки. Определяет состав и сроки изделия.
          </p>
          <datalist id={CATALOG_LIST}>
            {(catalog.data ?? []).map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>

          {rows.map((row, i) => (
            <div key={row.key} className="flex items-center gap-2">
              <Input
                list={CATALOG_LIST}
                aria-label={`Каталожный номер, позиция ${i + 1}`}
                value={row.catalogNumber}
                onChange={(e) => patch(row.key, { catalogNumber: e.target.value })}
                placeholder="Например: 07098-010A9"
                autoComplete="off"
                required={i === 0}
              />
              <Input
                type="number"
                min={1}
                max={99}
                aria-label={`Количество, позиция ${i + 1}`}
                value={row.quantity}
                onChange={(e) =>
                  patch(row.key, { quantity: Math.min(99, Math.max(1, Number(e.target.value))) })
                }
                className="w-20 shrink-0 tabular"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                icon={X}
                aria-label={`Убрать позицию ${i + 1}`}
                disabled={rows.length === 1}
                onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))}
              />
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => setRows((all) => [...all, blank()])}
            >
              Добавить номер
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={ClipboardPaste}
              onClick={() => setPasting((v) => !v)}
              aria-expanded={pasting}
            >
              Вставить списком
            </Button>
          </div>

          {pasting && (
            <div className="grid gap-2">
              <Textarea
                aria-label="Список каталожных номеров"
                rows={5}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={
                  'По одному номеру в строке, количество через пробел:\n07098-010A9 5\n48700-0021'
                }
              />
              <div>
                <Button size="sm" onClick={addPasted} disabled={pasted.trim() === ''}>
                  Добавить в заявку
                </Button>
              </div>
            </div>
          )}
        </fieldset>

        <Field label="Техника" hint="Одна на всю заявку. Можно оставить без привязки к технике">
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

        <AttachmentPicker uploads={uploads} />
      </form>
    </Dialog>
  )
}
