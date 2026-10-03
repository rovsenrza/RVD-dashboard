import { useMemo, useState, type FormEvent } from 'react'
import { ClipboardPaste, Plus, X } from 'lucide-react'
import { useSession } from '@/app/session'
import { ProductStatusBadge } from '@/entities/product'
import { REQUEST_KIND_HINT, REQUEST_KIND_LABEL } from '@/entities/request'
import { isSpreadsheet, MAX_REQUEST_POSITIONS } from '@/entities/request/rules'
import type { Product, RequestKind, RequestPosition } from '@/entities/types'
import { ApiError } from '@/shared/api/client'
import {
  useCatalogNumbers,
  useCreateRequest,
  useEquipment,
  useProducts,
} from '@/shared/api/queries'
import {
  Badge,
  Button,
  Dialog,
  Field,
  Input,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
  type SegmentedOption,
} from '@/shared/ui'
import { AttachmentPicker } from '@/features/attachments/AttachmentPicker'
import { useUploads } from '@/features/attachments/useUploads'
import { ProductPicker, ProductRow } from '@/features/products/components/ProductPicker'
import { productLabel } from '@/features/products/productLookup'
import { parsePositions } from '../parsePositions'

const NO_EQUIPMENT = ''
const CATALOG_LIST = 'request-catalog-numbers'

const KINDS: SegmentedOption<RequestKind>[] = (['replace', 'manufacture', 'repair'] as const).map(
  (value) => ({ value, label: REQUEST_KIND_LABEL[value] }),
)

// The hoses most likely to need replacing come first in the suggestions; the archive last.
const URGENCY: Record<Product['status'], number> = { replace: 0, warn: 1, no_warranty: 2, ok: 3 }
const byUrgency = (a: Product, b: Product) =>
  Number(a.lifecycle === 'written_off') - Number(b.lifecycle === 'written_off') ||
  URGENCY[a.status] - URGENCY[b.status] ||
  a.serialNumber.localeCompare(b.serialNumber)

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

/** What the form opens with: a hose card asks to replace its own hose. */
export interface RequestPreset {
  kind?: RequestKind
  products?: Product[]
}

/**
 * Three kinds, three ways to fill (customer, 2026-10-03). «Замена» picks the
 * company's own hoses — made, archive included — and never takes a typed
 * number; each hose brings its machine. «Изготовление» and «Ремонт» take
 * catalogue numbers typed, suggested or pasted, or none at all when an Excel
 * file carries them. Ten lines at most.
 */
export function RequestForm({ preset, onClose }: { preset?: RequestPreset; onClose: () => void }) {
  const catalog = useCatalogNumbers()
  const equipment = useEquipment()
  const stock = useProducts()
  const create = useCreateRequest()
  const toast = useToast()
  const { branch, branches } = useSession()

  const [kind, setKind] = useState<RequestKind>(preset?.kind ?? 'replace')
  const [picked, setPicked] = useState<Product[]>(preset?.products ?? [])
  const [miss, setMiss] = useState<string>()
  const [rows, setRows] = useState<Row[]>(() => [blank()])
  const [equipmentId, setEquipmentId] = useState(NO_EQUIPMENT)
  const [comment, setComment] = useState('')
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [leftOut, setLeftOut] = useState(0)
  const [error, setError] = useState<string>()
  const uploads = useUploads()

  const labelOf = (p: Product) => productLabel(p, equipment.data)
  const candidates = useMemo(
    () => (stock.data ?? []).filter((p) => p.lifecycle !== 'manufacturing').sort(byUrgency),
    [stock.data],
  )
  const taken = useMemo(() => new Set(picked.map((p) => p.id)), [picked])

  const known = (typed: string) =>
    catalog.data?.find((c) => c.name.toLowerCase() === typed.trim().toLowerCase())
  const filled = rows.filter((r) => r.catalogNumber.trim() !== '')
  const total = filled.reduce((sum, r) => sum + r.quantity, 0)
  const withExcel = uploads.items.some((u) => u.attachment && isSpreadsheet(u.attachment.fileName))
  const replacing = kind === 'replace'
  const full = (replacing ? picked.length : rows.length) >= MAX_REQUEST_POSITIONS
  const ready = replacing ? picked.length > 0 : filled.length > 0 || withExcel

  const patch = (key: number, part: Partial<Row>) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...part } : r)))

  /** Pasted lines join the filled ones, up to the ten-line ceiling; the rest are counted, not lost silently. */
  const addPasted = () => {
    const parsed = parsePositions(pasted)
    if (parsed.length === 0) return
    const kept = rows.filter((r) => r.catalogNumber.trim() !== '')
    const room = Math.max(0, MAX_REQUEST_POSITIONS - kept.length)
    setRows([...kept, ...parsed.slice(0, room).map((p) => blank(p.catalogNumber, p.quantity))])
    setLeftOut(Math.max(0, parsed.length - room))
    setPasted('')
    setPasting(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setError(undefined)
    const eq = equipment.data?.find((x) => x.id === equipmentId)
    const positions: RequestPosition[] = replacing
      ? picked.map((p) => ({
          productId: p.id,
          catalogNumberId: p.catalogNumberId,
          catalogNumber: p.catalogNumber,
          equipmentId: p.equipmentId,
          quantity: 1,
        }))
      : filled.map((r) => {
          const typed = r.catalogNumber.trim()
          // A number typed by hand may be absent from the catalogue; it goes as text and the manager resolves it.
          const hit = known(typed)
          return {
            productId: null,
            catalogNumberId: hit?.id ?? null,
            catalogNumber: hit?.name ?? typed,
            equipmentId: eq?.id ?? null,
            quantity: r.quantity,
          }
        })
    create.mutate(
      {
        // A replacement belongs where its hoses are; otherwise the chosen machine
        // decides the branch, and without one the branch in scope.
        branchId: replacing ? picked[0].branchId : (eq?.branchId ?? branch?.id ?? branches[0].id),
        productId: replacing && picked.length === 1 ? picked[0].id : null,
        kind,
        quantity: positions.reduce((sum, l) => sum + l.quantity, 0),
        comment: comment.trim() || null,
        attachmentIds: uploads.ids,
        positions,
      },
      {
        onSuccess: (created) => {
          toast(`Заявка ${created.number} создана`)
          onClose()
        },
        onError: (err) =>
          err instanceof ApiError && err.status === 400
            ? setError(err.message)
            : toast('Не удалось создать заявку', 'error'),
      },
    )
  }

  return (
    <Dialog
      open
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
            disabled={create.isPending || uploads.busy || !ready}
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
        <div className="grid gap-1.5">
          <span className="text-ui font-medium">Тип заявки</span>
          <SegmentedControl
            label="Тип заявки"
            value={kind}
            options={KINDS}
            onChange={(next) => {
              setKind(next)
              setError(undefined)
            }}
            className="justify-self-start"
          />
          <p className="text-label text-ink-muted">{REQUEST_KIND_HINT[kind]}</p>
        </div>

        {replacing ? (
          <Field
            label={`Изделия на замену · ${picked.length} из ${MAX_REQUEST_POSITIONS}`}
            hint={
              full
                ? `В одной заявке — до ${MAX_REQUEST_POSITIONS} изделий.`
                : 'Те, что пора менять, в подсказке первыми. Техника — у каждого изделия своя.'
            }
            error={miss}
          >
            {(id) => (
              <div className="grid gap-1.5">
                {picked.map((p) => (
                  <ProductRow
                    key={p.id}
                    label={labelOf(p)}
                    aside={
                      p.lifecycle === 'written_off' ? (
                        <Badge tone="none" dot>
                          Списано
                        </Badge>
                      ) : (
                        <ProductStatusBadge status={p.status} />
                      )
                    }
                    removeLabel={`Убрать EHS ${p.serialNumber}`}
                    onRemove={() => setPicked((all) => all.filter((x) => x.id !== p.id))}
                  />
                ))}
                <ProductPicker
                  id={id}
                  candidates={candidates}
                  labelOf={labelOf}
                  taken={taken}
                  disabled={full}
                  invalid={!!miss}
                  placeholder={picked.length ? 'Добавить ещё: EHS или ваш номер' : undefined}
                  onPick={(p) => setPicked((all) => [...all, p])}
                  onMiss={setMiss}
                />
              </div>
            )}
          </Field>
        ) : (
          <>
            <fieldset className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <legend className="text-ui font-medium">Каталожные номера (OEM)</legend>
                <span className="text-label text-ink-muted tabular">
                  {filled.length > 0
                    ? `Позиций: ${filled.length} из ${MAX_REQUEST_POSITIONS} · штук: ${total}`
                    : withExcel
                      ? 'Позиции — в таблице Excel'
                      : `До ${MAX_REQUEST_POSITIONS} позиций`}
                </span>
              </div>
              <datalist id={CATALOG_LIST}>
                {(catalog.data ?? []).map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>

              {rows.map((row, i) => {
                const typed = row.catalogNumber.trim()
                const unknown = typed !== '' && !!catalog.data && !known(typed)
                return (
                  <div key={row.key} className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <Input
                        list={CATALOG_LIST}
                        aria-label={`Каталожный № (OEM), позиция ${i + 1}`}
                        value={row.catalogNumber}
                        onChange={(e) => patch(row.key, { catalogNumber: e.target.value })}
                        placeholder="Например: 07098-010A9"
                        autoComplete="off"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        aria-label={`Количество, позиция ${i + 1}`}
                        value={row.quantity}
                        onChange={(e) =>
                          patch(row.key, {
                            quantity: Math.min(99, Math.max(1, Number(e.target.value))),
                          })
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
                    {unknown && (
                      <p className="text-label text-ink-muted">
                        Номера нет в справочнике — менеджер уточнит конструкцию и свяжется с вами.
                      </p>
                    )}
                  </div>
                )
              })}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  disabled={full}
                  onClick={() => setRows((all) => [...all, blank()])}
                >
                  Добавить номер
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ClipboardPaste}
                  disabled={full && filled.length === rows.length}
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

              {leftOut > 0 ? (
                <p className="text-label font-medium text-ink-secondary">
                  Не вошли строк: {leftOut} — в заявке до {MAX_REQUEST_POSITIONS} позиций. Приложите
                  полный список таблицей Excel.
                </p>
              ) : (
                filled.length === 0 &&
                !withExcel && (
                  <p className="text-label text-ink-muted">
                    Можно не вписывать номера, а приложить таблицу Excel ниже — менеджер возьмёт
                    позиции из неё.
                  </p>
                )
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
          </>
        )}

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

        {error && (
          <p role="alert" className="text-label text-status-replace-ink">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}
