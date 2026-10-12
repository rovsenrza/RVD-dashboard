import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Scale } from 'lucide-react'
import type { ModelStats } from '@/entities/types'
import { ProductStatusBar, STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '@/entities/product'
import { useSession } from '@/app/session'
import { useModelStats } from '@/shared/api/queries'
import { useReducedMotion } from '@/shared/lib/motion'
import { formatNumber } from '@/shared/lib/utils'
import {
  Badge,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  PageHeader,
  QueryState,
  Skeleton,
} from '@/shared/ui'
import { bestOf, METRICS, type Metric } from './metrics'

const MAX = 4

export function ComparePage() {
  const { user, branch } = useSession()
  const stats = useModelStats()
  const allowed = user.role === 'manager' || user.role === 'admin'

  return (
    <>
      <PageHeader
        title="Сравнение техники"
        description={`Как РВД служат на разной технике: состояние сейчас и замены за год · ${branch?.name ?? 'Все филиалы'}`}
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
          {(models) => <Comparison models={models} />}
        </QueryState>
      )}
    </>
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

  // Brand and model, then the units of it by garage number.
  const groups = useMemo(() => {
    const byModel = new Map<string, ModelStats[]>()
    for (const m of models) byModel.set(m.model, [...(byModel.get(m.model) ?? []), m])
    return [...byModel]
  }, [models])

  return (
    <div className="grid gap-5">
      <Card
        title="Техника"
        action={
          <span className="text-label text-ink-muted">
            выбрано {chosen.length} из {MAX}
          </span>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(([model, units]) => (
            <fieldset key={model} className="min-w-0">
              <legend className="mb-2 text-ui font-medium">
                {model}
                <span className="ml-2 text-label font-normal text-ink-muted">
                  {units[0].type} · {units.length} ед.
                </span>
              </legend>
              <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                {units.map((m) => {
                  const on = chosen.includes(m.id)
                  return (
                    <Checkbox
                      key={m.id}
                      label={m.garageNumber ?? m.model}
                      hint={`${formatNumber(m.hoses)} РВД`}
                      checked={on}
                      disabled={!on && chosen.length >= MAX}
                      onChange={(e) => toggle(m.id, e.target.checked)}
                    />
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </Card>

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
  const data = models.map((m) => ({ model: nameOf(m), value: m.replacements12m }))
  return (
    <Card title="Замен за 12 месяцев">
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
    </Card>
  )
}
