import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Scale } from 'lucide-react'
import type { ModelStats } from '@/entities/types'
import { ProductStatusBar, STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '@/entities/product'
import { useSession } from '@/app/session'
import { useModelStats } from '@/shared/api/queries'
import { useReducedMotion } from '@/shared/lib/motion'
import { cn, formatNumber } from '@/shared/lib/utils'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DatePicker,
  EmptyState,
  Field,
  PageHeader,
  QueryState,
  SearchInput,
  Select,
  Skeleton,
} from '@/shared/ui'
import { bestOf, METRICS, type Metric } from './metrics'

const MAX = 4

export function ComparePage() {
  const { user, branch } = useSession()
  // The period lives in the address, like the pick, so a comparison sent as a link keeps it.
  const [params, setParams] = useSearchParams()
  const asked = { from: params.get('from'), to: params.get('to') }
  const stats = useModelStats(asked)
  const allowed = user.role === 'manager' || user.role === 'admin'
  const setPeriod = (patch: { from?: string | null; to?: string | null }) => {
    for (const [key, value] of Object.entries(patch))
      if (value) params.set(key, value)
      else params.delete(key)
    setParams(params, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Сравнение техники"
        description={`Как РВД служат на разной технике: состояние и замены за период · ${branch?.name ?? 'Все филиалы'}`}
      />
      {!allowed ? (
        <Card>
          <EmptyState
            inset
            icon={Scale}
            title="Раздел для руководителя"
            description="Сравнение техники доступно руководителю и администратору. В демо роль меняется в меню пользователя."
          />
        </Card>
      ) : (
        <QueryState query={stats} skeleton={<Skeleton className="sheet h-96" />}>
          {({ period, models }) => (
            <div
              aria-busy={stats.isPlaceholderData || undefined}
              className={cn(
                'grid gap-5 transition-opacity duration-150',
                stats.isPlaceholderData && 'opacity-60',
              )}
            >
              <PeriodBar period={period} custom={!!(asked.from || asked.to)} onChange={setPeriod} />
              <Comparison models={models} />
            </div>
          )}
        </QueryState>
      )}
    </>
  )
}

/**
 * «С … по …», as in 1С (customer, 2026-10-16): hoses made in the period, as they
 * stand today, and the replacements done in it. Opens on all of the company's
 * time, from its first hose made to today.
 */
function PeriodBar({
  period,
  custom,
  onChange,
}: {
  period: { from: string; to: string }
  custom: boolean
  onChange: (patch: { from?: string | null; to?: string | null }) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid grid-cols-2 gap-3 max-sm:w-full sm:w-80">
        <Field label="Период с">
          {(id) => (
            <DatePicker
              id={id}
              value={period.from}
              max={period.to}
              onChange={(v) => v && onChange({ from: v })}
            />
          )}
        </Field>
        <Field label="по">
          {(id) => (
            <DatePicker
              id={id}
              value={period.to}
              min={period.from}
              onChange={(v) => v && onChange({ to: v })}
            />
          )}
        </Field>
      </div>
      {custom && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ from: null, to: null })}>
          За всё время
        </Button>
      )}
    </div>
  )
}

/** «НТ04 · Komatsu PC400»: the unit compared, as people name it. */
const nameOf = (m: ModelStats) => (m.garageNumber ? `${m.garageNumber} · ${m.model}` : m.model)

function Comparison({ models }: { models: ModelStats[] }) {
  // The pick lives in the URL (?m=…), so a comparison can be sent to someone as a link.
  const [params, setParams] = useSearchParams()
  const picked = params.getAll('m').filter((id) => models.some((x) => x.id === id))
  // Until something is picked: the two machines with the most hoses.
  const chosen = params.has('m')
    ? picked
    : [...models]
        .sort((a, b) => b.hoses - a.hoses)
        .slice(0, 2)
        .map((m) => m.id)
  const shown = models.filter((m) => chosen.includes(m.id))

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...chosen, id] : chosen.filter((m) => m !== id)
    params.delete('m')
    for (const m of next) params.append('m', m)
    // An empty pick is still a pick: keep the key so the defaults do not come back.
    if (!next.length) params.append('m', '')
    setParams(params, { replace: true })
  }

  return (
    <div className="grid gap-5">
      <MachinePicker models={models} chosen={chosen} onToggle={toggle} />

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            inset
            icon={Scale}
            title="Отметьте технику для сравнения"
            description={`От 2 до ${MAX} единиц: по марке, модели и гаражному номеру.`}
          />
        </Card>
      ) : (
        <>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <StatusByModel models={shown} />
            <ReplacementsPerMachine models={shown} />
          </div>
          <ComparisonTable models={shown} />
        </>
      )}
    </div>
  )
}

/**
 * The pick on top as chips, the fleet below in one block of fixed height that
 * scrolls: a search over garage number, brand, model and type, a type filter,
 * and the units grouped by brand and model. Holds a fleet of hundreds the same
 * as a fleet of ten.
 */
function MachinePicker({
  models,
  chosen,
  onToggle,
}: {
  models: ModelStats[]
  chosen: string[]
  onToggle: (id: string, on: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const types = useMemo(
    () =>
      [...new Set(models.map((m) => m.type).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [models],
  )
  // Brand and model, then the units of it by garage number, narrowed by the search and type.
  const groups = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const byModel = new Map<string, ModelStats[]>()
    for (const m of models) {
      if (type && m.type !== type) continue
      const text = `${m.garageNumber ?? ''} ${m.model} ${m.type}`.toLowerCase()
      if (!words.every((w) => text.includes(w))) continue
      byModel.set(m.model, [...(byModel.get(m.model) ?? []), m])
    }
    return [...byModel]
  }, [models, query, type])
  const picked = chosen.flatMap((id) => models.filter((m) => m.id === id))
  const full = chosen.length >= MAX

  return (
    <Card
      title="Техника"
      action={
        <span className="text-label text-ink-muted tabular">
          выбрано {chosen.length} из {MAX}
        </span>
      }
    >
      <div className="grid gap-4">
        <div className="flex min-h-7 flex-wrap items-center gap-2">
          {picked.length ? (
            picked.map((m) => (
              <Chip
                key={m.id}
                onRemove={() => onToggle(m.id, false)}
                removeLabel={`Убрать ${nameOf(m)}`}
              >
                {nameOf(m)}
              </Chip>
            ))
          ) : (
            <span className="text-label text-ink-muted">
              Отметьте в списке от 2 до {MAX} единиц
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput
            aria-label="Поиск техники"
            placeholder="Гаражный №, марка, модель…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:flex-1"
          />
          {types.length > 1 && (
            <Select
              aria-label="Тип техники"
              placeholder="Все типы"
              options={types.map((t) => ({ value: t, label: t }))}
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="sm:w-56"
            />
          )}
        </div>

        <div className="-mx-5 max-h-80 overflow-y-auto border-y border-line">
          {groups.length ? (
            groups.map(([model, units]) => (
              <div key={model} role="group" aria-label={model}>
                {/* Sticks while its own units scroll by, so a long group keeps its name. */}
                <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-sheet px-5 pt-3 pb-1.5 text-ui font-medium">
                  {model}
                  <span className="text-label font-normal text-ink-muted">
                    {units[0].type} · {units.length} ед.
                  </span>
                </div>
                <div className="grid gap-x-6 gap-y-2.5 px-5 pb-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {units.map((m) => {
                    const on = chosen.includes(m.id)
                    return (
                      <Checkbox
                        key={m.id}
                        label={<span className="break-words">{m.garageNumber ?? m.model}</span>}
                        hint={`${formatNumber(m.hoses)} РВД`}
                        checked={on}
                        disabled={!on && full}
                        onChange={(e) => onToggle(m.id, e.target.checked)}
                      />
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="px-5 py-8 text-center text-ink-muted">По запросу ничего не найдено</p>
          )}
        </div>
      </div>
    </Card>
  )
}

/** Status mix per model on the same bar as everywhere else, with the legend it needs. */
function StatusByModel({ models }: { models: ModelStats[] }) {
  return (
    <Card title="Состояние РВД сейчас">
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-label text-ink-secondary">
        {STATUS_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />
            {STATUS_LABEL[k]}
          </li>
        ))}
      </ul>
      <ul className="grid gap-4">
        {models.map((m) => (
          <li key={m.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-ui font-medium">{nameOf(m)}</span>
              <span className="text-label text-ink-muted tabular">{formatNumber(m.hoses)} РВД</span>
            </div>
            <ProductStatusBar breakdown={m.breakdown} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** One series, one colour: models are named on the axis, the value sits at the bar's end. */
function ReplacementsPerMachine({ models }: { models: ModelStats[] }) {
  const still = useReducedMotion()
  const data = models.map((m) => ({ model: nameOf(m), value: m.replacements }))
  return (
    <Card title="Замен за период">
      <div style={{ height: 56 + data.length * 44 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="model"
              width={150}
              tick={{ fontSize: 12.5, fill: 'var(--color-ink-secondary)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              separator=": "
              cursor={{ fill: 'var(--color-wash)' }}
              wrapperStyle={{ zIndex: 20 }}
              formatter={(v) => [String(v), 'Замен']}
              contentStyle={{
                borderRadius: 10,
                border: 'none',
                background: 'var(--color-pop)',
                color: 'var(--color-ink)',
                boxShadow: 'var(--shadow-pop)',
                fontSize: 12.5,
              }}
              itemStyle={{ color: 'var(--color-ink)' }}
            />
            <Bar
              isAnimationActive={!still}
              dataKey="value"
              fill="var(--color-brand)"
              radius={[0, 4, 4, 0]}
              barSize={18}
            >
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v) => String(v).replace('.', ',')}
                style={{ fontSize: 12.5, fill: 'var(--color-ink)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-label text-ink-muted">
        Меньше — лучше: реже приходится останавливать технику ради замены.
      </p>
    </Card>
  )
}

interface Row {
  metric: Metric
  best: string | null
}

/** Metrics down, models across; the best model per row is marked where «better» is unambiguous. */
function ComparisonTable({ models }: { models: ModelStats[] }) {
  const rows: Row[] = useMemo(
    () => METRICS.map((metric) => ({ metric, best: bestOf(metric, models) })),
    [models],
  )
  const columns = useMemo(
    () =>
      [
        {
          id: 'metric',
          header: 'Показатель',
          accessorFn: (r) => r.metric.label,
          enableSorting: false,
          meta: { mobile: 'title' },
          cell: (c) => <span className="text-ink-secondary">{c.getValue() as string}</span>,
        },
        ...models.map<ColumnDef<Row, unknown>>((m) => ({
          id: m.id,
          header: nameOf(m),
          enableSorting: false,
          cell: ({ row }) => (
            <span className="inline-flex items-center gap-2">
              <span className={row.original.best === m.id ? 'font-medium' : undefined}>
                {row.original.metric.value(m)}
              </span>
              {row.original.best === m.id && <Badge tone="ok">лучше</Badge>}
            </span>
          ),
        })),
      ] as ColumnDef<Row, unknown>[],
    [models],
  )
  return (
    <Card title="Сравнение">
      <DataTable embedded data={rows} columns={columns} pageSize={20} />
      <p className="mt-3 text-label text-ink-muted">
        «Лучше» — лучший результат среди выбранных машин там, где ясно, что лучше: меньше РВД к
        замене, меньше замен и поломок, дольше срок службы. Машина без РВД в долях не участвует.
      </p>
    </Card>
  )
}
