import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { ClipboardPaste, Plus, X } from 'lucide-react'
import { useSession } from '@/app/session'
import { ProductStatusBadge } from '@/entities/product'
import { REQUEST_KIND_HINT, REQUEST_KIND_LABEL } from '@/entities/request'
import { isSpreadsheet, MAX_REQUEST_POSITIONS } from '@/entities/request/rules'
import type { Product, RequestKind, RequestPosition } from '@/entities/types'
import { ApiError } from '@/shared/api/client'
import { useCatalogNumbers, useCreateRequest, useEquipment } from '@/shared/api/queries'
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

/** Never a hose still being made; a written-off one can be ordered again, never repaired. */
const eligibleFor = (kind: RequestKind) => (p: Product) =>
  p.lifecycle !== 'manufacturing' && (kind !== 'repair' || p.lifecycle !== 'written_off')

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

/** What the form opens with: a hose card brings its hose, a machine card puts its own hoses first. */
export interface RequestPreset {
  kind?: RequestKind
  products?: Product[]
  equipmentId?: string
}

/**
 * Three kinds, three ways to fill (customer, 2026-10-03). «Замена» picks the
 * company's own hoses — made, archive included — and never takes a typed
 * number; each hose brings its machine. «Изготовление» and «Ремонт» take
 * catalogue numbers typed, suggested or pasted, or none at all when an Excel
 * file carries them. Ten lines at most.
 */
export function RequestForm({
  preset,
  onClose,
  onCreated,
}: {
  preset?: RequestPreset
  onClose: () => void
  /** After the server took the request, before the form closes */
  onCreated?: () => void
}) {
  const catalog = useCatalogNumbers()
  const equipment = useEquipment()
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
  const machine = preset?.equipmentId
  const eligible = useMemo(() => eligibleFor(kind), [kind])
  // The machine the form is about first, then the hoses most likely to need replacing.
  const order = useCallback(
    (a: Product, b: Product) =>
      Number(b.equipmentId === machine && !!machine) -
        Number(a.equipmentId === machine && !!machine) || byUrgency(a, b),
    [machine],
  )
  const taken = useMemo(() => new Set(picked.map((p) => p.id)), [picked])

  const known = (typed: string) =>
    catalog.data?.find((c) => c.name.toLowerCase() === typed.trim().toLowerCase())
  const filled = rows.filter((r) => r.catalogNumber.trim() !== '')
  const total = filled.reduce((sum, r) => sum + r.quantity, 0)
  const withExcel = uploads.items.some((u) => u.attachment && isSpreadsheet(u.attachment.fileName))
  const replacing = kind === 'replace'
  // «Замена» names hoses only, «Изготовление» numbers only, «Ремонт» either or both.
  const withHoses = kind !== 'manufacture'
  const withRows = kind !== 'replace'
  // Switching kinds keeps the picks; a kind shows (and sends) only those it may name.
  const hoses = withHoses ? picked.filter(eligible) : []
  const hosesFull = hoses.length + (withRows ? filled.length : 0) >= MAX_REQUEST_POSITIONS
  const rowsFull = hoses.length + rows.length >= MAX_REQUEST_POSITIONS
  const ready = replacing ? hoses.length > 0 : hoses.length > 0 || filled.length > 0 || withExcel

  const patch = (key: number, part: Partial<Row>) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...part } : r)))

  /** Pasted lines join the filled ones, up to the ten-line ceiling; the rest are counted, not lost silently. */
  const addPasted = () => {
    const parsed = parsePositions(pasted)
    if (parsed.length === 0) return
    const kept = rows.filter((r) => r.catalogNumber.trim() !== '')
    const room = Math.max(0, MAX_REQUEST_POSITIONS - hoses.length - kept.length)
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
    const positions: RequestPosition[] = [
      ...hoses.map((p) => ({
        productId: p.id,
        catalogNumberId: p.catalogNumberId,
        catalogNumber: p.catalogNumber,
        equipmentId: p.equipmentId,
        quantity: 1,
      })),
      ...(withRows ? filled : []).map((r) => {
        const typed = r.catalogNumber.trim()
        // Text the catalogue does not know — a number or, for a repair, the work — goes
        // as typed and the manager resolves it.
        const hit = known(typed)
        return {
          productId: null,
          catalogNumberId: hit?.id ?? null,
          catalogNumber: hit?.name ?? typed,
          equipmentId: eq?.id ?? null,
          quantity: r.quantity,
        }
      }),
    ]
    create.mutate(
      {
        // A replacement belongs where its hoses are; otherwise the chosen machine
        // decides the branch, and without one the branch in scope.
        branchId: hoses[0]?.branchId ?? eq?.branchId ?? branch?.id ?? branches[0].id,
        productId: positions.length === 1 ? positions[0].productId : null,
        kind,
        quantity: positions.reduce((sum, l) => sum + l.quantity, 0),
        comment: comment.trim() || null,
        attachmentIds: uploads.ids,
        attachmentNames: uploads.items.flatMap((u) =>
          u.attachment ? [u.attachment.fileName] : [],
        ),
        positions,
      },
      {
        onSuccess: (created) => {
          toast(
            created.number
              ? `Заявка ${created.number} создана`
              : 'Заявка принята — отправляем её в 1С',
          )
          onCreated?.()
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

        {withHoses && (
          <Field
            label={
              replacing
                ? `Изделия на замену · ${hoses.length} из ${MAX_REQUEST_POSITIONS}`
                : `Наши изделия в ремонт${hoses.length ? ` · ${hoses.length}` : ''}`
            }
            hint={
              hosesFull
                ? `В одной заявке — до ${MAX_REQUEST_POSITIONS} позиций.`
                : replacing
                  ? 'Те, что пора менять, в подсказке первыми. Техника — у каждого изделия своя.'
                  : 'Если ремонтируем изделие, которое мы поставили, — выберите его. Если нет — опишите работу ниже.'
            }
            error={miss}
          >
            {(id) => (
              <div className="grid gap-1.5">
                {hoses.map((p) => (
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
                  eligible={eligible}
                  near={machine}
                  order={order}
                  labelOf={labelOf}
                  taken={taken}
                  disabled={hosesFull}
                  invalid={!!miss}
                  placeholder={hoses.length ? 'Добавить ещё: EHS или ваш номер' : undefined}
                  onPick={(p) => setPicked((all) => [...all, p])}
                  onMiss={setMiss}
                />
              </div>
            )}
          </Field>
        )}

        {withRows && (
          <>
            <fieldset className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <legend className="text-ui font-medium">
                  {kind === 'repair' ? 'Что отремонтировать' : 'Каталожные номера (OEM)'}
                </legend>
                <span className="text-label text-ink-muted tabular">
                  {filled.length > 0
                    ? `Позиций: ${hoses.length + filled.length} из ${MAX_REQUEST_POSITIONS} · штук: ${hoses.length + total}`
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
                // A repair line is free text: only a number for manufacture can be «unknown».
                const unknown =
                  kind === 'manufacture' && typed !== '' && !!catalog.data && !known(typed)
                return (
                  <div key={row.key} className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <Input
                        list={CATALOG_LIST}
                        aria-label={`${kind === 'repair' ? 'Что отремонтировать' : 'Каталожный № (OEM)'}, позиция ${i + 1}`}
                        value={row.catalogNumber}
                        onChange={(e) => patch(row.key, { catalogNumber: e.target.value })}
                        placeholder={
                          kind === 'repair'
                            ? 'Например: 2SC ду10 — течь у муфты'
                            : 'Например: 07098-010A9'
                        }
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
                  disabled={rowsFull}
                  onClick={() => setRows((all) => [...all, blank()])}
                >
                  {kind === 'repair' ? 'Добавить работу' : 'Добавить номер'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ClipboardPaste}
                  disabled={rowsFull && filled.length === rows.length}
                  onClick={() => setPasting((v) => !v)}
                  aria-expanded={pasting}
                >
                  Вставить списком
                </Button>
              </div>

              {pasting && (
                <div className="grid gap-2">
                  <Textarea
                    aria-label={kind === 'repair' ? 'Список работ' : 'Список каталожных номеров'}
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
                hoses.length === 0 &&
                !withExcel && (
                  <p className="text-label text-ink-muted">
                    {kind === 'repair'
                      ? 'Можно не заполнять, а приложить таблицу Excel ниже — менеджер возьмёт позиции из неё.'
                      : 'Можно не вписывать номера, а приложить таблицу Excel ниже — менеджер возьмёт позиции из неё.'}
                  </p>
                )
              )}
            </fieldset>

            <Field
              label="Техника"
              hint={
                kind === 'repair'
                  ? 'Для работ, описанных текстом. У выбранных изделий техника своя'
                  : 'Одна на всю заявку. Можно оставить без привязки к технике'
              }
            >
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
