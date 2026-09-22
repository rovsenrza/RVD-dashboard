import { useState, type ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Download,
  Info,
  Package,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { ProductStatusBadge, ProductStatusBar } from '@/entities/product'
import { RequestStatusBadge } from '@/entities/request'
import type { ProductStatus, RequestStatus } from '@/entities/types'
import {
  Badge,
  Button,
  Card,
  Chip,
  DataTable,
  DatePicker,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Kbd,
  KpiCard,
  KpiStrip,
  Menu,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  Tabs,
  TableSkeleton,
  Tooltip,
  useToast,
} from '@/shared/ui'

/**
 * Living catalogue of shared/ui and the domain badges, mounted at /dev/ui in
 * dev builds only (see router.tsx). Switch the theme in the user menu to check
 * every token and primitive in both themes on one screen.
 */
export function UiPage() {
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Компоненты"
        description="Витрина shared/ui и доменных меток. Только в dev-сборке."
      />
      <Colors />
      <Type />
      <Buttons />
      <Fields />
      <Marks />
      <Overlays />
      <KpiStrip>
        <KpiCard label="Отгружено изделий" value={187} delta={19} icon={Package} />
        <KpiCard label="На гарантии" value={70} delta={-31} icon={ShieldCheck} tone="ok" />
        <KpiCard label="Срок истекает" value={13} icon={Info} tone="warn" />
        <KpiCard label="Требуют замены" value={25} delta={31} icon={AlertTriangle} tone="replace" />
      </KpiStrip>
      <Table />
      <States />
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[160px_1fr] md:items-center">
      <div className="text-label text-ink-muted">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

const COLOR_GROUPS: [string, string[]][] = [
  [
    'Поверхности',
    ['field', 'sheet', 'sheet-muted', 'pop', 'row-hover', 'line', 'line-strong', 'wash', 'scrim'],
  ],
  ['Текст', ['ink', 'ink-secondary', 'ink-muted', 'ink-faint', 'on-brand', 'on-status']],
  ['Акцент', ['brand', 'brand-dark', 'brand-press', 'brand-deep', 'brand-soft']],
  ['Рейл', ['rail', 'rail-raised', 'rail-hover', 'rail-ink', 'rail-muted']],
  ...(['ok', 'warn', 'replace', 'none'] as const).map((s): [string, string[]] => [
    `Статус · ${s}`,
    [`status-${s}`, `status-${s}-soft`, `status-${s}-ink`],
  ]),
]

function Colors() {
  return (
    <Card title="Цвета">
      <div className="divide-y divide-line">
        {COLOR_GROUPS.map(([group, names]) => (
          <Row key={group} label={group}>
            {names.map((n) => (
              <div key={n} className="flex w-44 items-center gap-2">
                <span
                  className="size-8 shrink-0 rounded-lg shadow-[inset_0_0_0_1px_var(--color-line)]"
                  style={{ background: `var(--color-${n})` }}
                />
                <span className="text-caption text-ink-secondary">{n}</span>
              </div>
            ))}
          </Row>
        ))}
      </div>
    </Card>
  )
}

function Type() {
  return (
    <Card title="Типографика">
      <div className="divide-y divide-line">
        <Row label="text-kpi · 28">
          <span className="text-kpi leading-none font-semibold tracking-[-0.02em] tabular">
            187
          </span>
        </Row>
        <Row label="text-title · 22">
          <span className="text-title font-semibold tracking-[-0.02em]">Мои изделия</span>
        </Row>
        <Row label="text-heading · 17">
          <span className="text-heading font-semibold tracking-[-0.01em]">Вход</span>
        </Row>
        <Row label="text-sheet-title · 15">
          <span className="text-sheet-title font-semibold tracking-[-0.01em]">
            Ближайшие плановые замены
          </span>
        </Row>
        <Row label="text-sm · 14">Рукав 2SC ду06, стрела, левый контур — 12.07.2026</Row>
        <Row label="text-ui · 13.5">
          <span className="text-ui text-ink-muted">Реестр РВД, отгруженных вашей компании</span>
        </Row>
        <Row label="text-label · 12.5">
          <span className="text-label text-ink-muted">47 за 12 мес.</span>
        </Row>
        <Row label="text-caption · 12">
          <span className="text-caption font-medium tracking-wide text-ink-muted uppercase">
            Плановая дата
          </span>
        </Row>
        <Row label="text-micro · 11">
          <span className="text-micro tracking-wide text-ink-muted uppercase">личный кабинет</span>
        </Row>
      </div>
    </Card>
  )
}

function Buttons() {
  return (
    <Card title="Кнопки">
      <div className="divide-y divide-line">
        {(['md', 'sm'] as const).map((size) => (
          <Row key={size} label={`Размер ${size}`}>
            <Button size={size} icon={Plus}>
              Создать заявку
            </Button>
            <Button size={size} variant="secondary" icon={Download}>
              Экспорт
            </Button>
            <Button size={size} variant="ghost">
              Отмена
            </Button>
            <Button size={size} variant="danger" icon={Trash2}>
              Удалить
            </Button>
          </Row>
        ))}
        <Row label="Иконки">
          <Button size="icon" variant="secondary" icon={Pencil} aria-label="Изменить" />
          <Button size="icon-sm" variant="ghost" icon={Settings} aria-label="Настройки" />
        </Row>
        <Row label="Недоступна">
          <Button disabled>Сохраняем…</Button>
          <Button variant="secondary" disabled>
            Экспорт
          </Button>
        </Row>
        <Row label="На рейле">
          <span className="rounded-lg bg-rail p-2">
            <Button variant="rail" icon={Settings}>
              Помощь
            </Button>
          </span>
        </Row>
      </div>
    </Card>
  )
}

function Fields() {
  const [date, setDate] = useState('2026-07-12')
  const [period, setPeriod] = useState('30')
  return (
    <Card title="Поля ввода">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Внутренний №" hint="Номер в вашем учёте">
          {(id) => <Input id={id} placeholder="К-1003" />}
        </Field>
        <Field label="Гаражный №" error="Такой техники нет в филиале">
          {(id) => <Input id={id} defaultValue="НТ99" aria-invalid />}
        </Field>
        <Field label="Место установки">
          {(id) => (
            <Select
              id={id}
              placeholder="Выберите место"
              options={[
                { value: 'boom', label: 'Стрела, левый контур' },
                { value: 'bucket', label: 'Ковш' },
              ]}
            />
          )}
        </Field>
        <Field label="Дата установки" hint={date ? `Значение: ${date}` : 'Пусто'}>
          {(id) => (
            <DatePicker
              id={id}
              value={date}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={setDate}
            />
          )}
        </Field>
        <Field label="Поиск">
          {(id) => (
            <SearchInput id={id} placeholder="EHS, OEM, гаражный номер…" hint={<Kbd>⌘K</Kbd>} />
          )}
        </Field>
        <div>
          <div className="mb-1.5 text-ui font-medium">Период</div>
          <SegmentedControl
            label="Период"
            value={period}
            onChange={setPeriod}
            options={[
              { value: '30', label: '30 дней' },
              { value: '90', label: '90 дней' },
              { value: '365', label: 'Год' },
            ]}
          />
        </div>
      </div>
    </Card>
  )
}

const PRODUCT_STATUSES: ProductStatus[] = ['ok', 'warn', 'replace', 'no_warranty']
const REQUEST_STATUSES: RequestStatus[] = ['new', 'in_progress', 'done', 'rejected']

function Marks() {
  const [chips, setChips] = useState(['Статус: Требуется замена', 'Техника: НТ04'])
  return (
    <Card title="Статусы и метки">
      <div className="divide-y divide-line">
        <Row label="Badge">
          {(['neutral', 'brand', 'ok', 'warn', 'replace', 'none'] as const).map((tone) => (
            <Badge key={tone} tone={tone} dot>
              {tone}
            </Badge>
          ))}
        </Row>
        <Row label="Статус изделия">
          {PRODUCT_STATUSES.map((s) => (
            <ProductStatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row label="Статус заявки">
          {REQUEST_STATUSES.map((s) => (
            <RequestStatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row label="Фильтры">
          {chips.map((c) => (
            <Chip key={c} onRemove={() => setChips((list) => list.filter((x) => x !== c))}>
              {c}
            </Chip>
          ))}
        </Row>
        <Row label="Состав техники">
          <div className="w-72">
            <ProductStatusBar breakdown={{ ok: 7, warn: 1, replace: 3, no_warranty: 5 }} />
          </div>
        </Row>
      </div>
    </Card>
  )
}

function Overlays() {
  const toast = useToast()
  const [tab, setTab] = useState<'active' | 'archive'>('active')
  const [dialog, setDialog] = useState(false)
  return (
    <Card title="Навигация и всплывающие">
      <div className="divide-y divide-line">
        <Row label="Tabs">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { key: 'active', label: 'Активные', count: 187 },
              { key: 'archive', label: 'Архив', count: 47 },
            ]}
          />
        </Row>
        <Row label="Menu">
          <Menu
            align="start"
            trigger={() => (
              <Button variant="secondary" size="sm">
                Действия
              </Button>
            )}
            items={[
              { label: 'Изменить', icon: Pencil },
              { label: 'Экспорт', icon: Download },
              { label: 'Удалить', icon: Trash2, danger: true, separator: true },
            ]}
          />
        </Row>
        <Row label="Tooltip">
          <Tooltip content="Остаток ресурса считается от даты установки">
            <Button size="icon-sm" variant="ghost" icon={Info} aria-label="Как считается остаток" />
          </Tooltip>
          <Tooltip content="Снизу, если сверху нет места" side="bottom">
            <Button size="sm" variant="secondary">
              Подсказка снизу
            </Button>
          </Tooltip>
        </Row>
        <Row label="Dialog">
          <Button size="sm" variant="secondary" onClick={() => setDialog(true)}>
            Открыть диалог
          </Button>
          <Dialog
            open={dialog}
            onClose={() => setDialog(false)}
            title="Новая заявка"
            description="Заявка уйдёт в 1С как заказ клиента."
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setDialog(false)}>
                  Отмена
                </Button>
                <Button size="sm" onClick={() => setDialog(false)}>
                  Отправить
                </Button>
              </>
            }
          >
            <Field label="Комментарий">{(id) => <Input id={id} />}</Field>
          </Dialog>
        </Row>
        <Row label="Toast">
          <Button size="sm" variant="secondary" onClick={() => toast('Заявка отправлена')}>
            Успех
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast('1С не ответила, повторим позже', 'error')}
          >
            Ошибка
          </Button>
        </Row>
      </div>
    </Card>
  )
}

interface SampleRow {
  ehs: string
  type: string
  place: string
  status: ProductStatus
}

const SAMPLE: SampleRow[] = [
  { ehs: '48760', type: '2SC ду06', place: 'Ковш', status: 'ok' },
  { ehs: '48851', type: 'R13 ду32', place: 'Стрела, левый контур', status: 'warn' },
  { ehs: '48706', type: 'R13 ду32', place: 'Ковш', status: 'replace' },
  { ehs: '48807', type: '2SC ду06', place: 'Рукоять', status: 'no_warranty' },
]

const COLUMNS: ColumnDef<SampleRow, unknown>[] = [
  { accessorKey: 'ehs', header: 'EHS №' },
  { accessorKey: 'type', header: 'Тип' },
  { accessorKey: 'place', header: 'Место установки' },
  {
    accessorKey: 'status',
    header: 'Статус',
    cell: ({ row }) => <ProductStatusBadge status={row.original.status} />,
  },
]

function Table() {
  return (
    <Card title="Таблица" padded={false}>
      <DataTable embedded tools data={SAMPLE} columns={COLUMNS} onRowClick={() => {}} />
    </Card>
  )
}

function States() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="Пусто">
        <EmptyState inset title="Замен ещё не было" description="Здесь появится журнал замен." />
      </Card>
      <Card title="Ошибка">
        <ErrorState message="Не удалось загрузить изделия" onRetry={() => {}} />
      </Card>
      <Card title="Загрузка">
        <div className="grid gap-3">
          <Skeleton className="h-6 w-1/2" />
          <TableSkeleton rows={3} />
        </div>
      </Card>
    </div>
  )
}
