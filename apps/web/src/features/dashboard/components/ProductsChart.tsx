import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DashboardSummary } from '@/entities/types'
import { STATUS_COLOR } from '@/entities/product'
import { Card } from '@/shared/ui'
import { useReducedMotion } from '@/shared/lib/motion'

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const monthLabel = (m: string) => MONTHS[Number(m.slice(5)) - 1] ?? m

/** The two parts of a month's bar, bottom first: what was made, then what replaced a hose. */
const SERIES = [
  { key: 'made', label: 'Изготовлено', color: 'var(--color-brand)' },
  { key: 'replaced', label: 'На замену', color: STATUS_COLOR.replace },
] as const

/**
 * «Изделия по месяцам» (customer, 2026-10-13): the hoses made for the company each
 * month, the ones made to replace one of theirs stacked on top in red.
 */
export function ProductsChart({
  data,
  className,
}: {
  data: DashboardSummary['productsByMonth']
  className?: string
}) {
  const still = useReducedMotion()
  const total = data.reduce((s, d) => s + d.made + d.replaced, 0)
  return (
    <Card
      title="Изделия по месяцам"
      action={<span className="text-label text-ink-muted tabular">{total} за 12 мес.</span>}
      className={className}
    >
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-label text-ink-secondary">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            barCategoryGap="28%"
          >
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tick={{ fontSize: 11.5, fill: 'var(--color-ink-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11.5, fill: 'var(--color-ink-muted)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              separator=": "
              cursor={{ fill: 'var(--color-brand-soft)', opacity: 0.6 }}
              contentStyle={{
                borderRadius: 10,
                border: 'none',
                background: 'var(--color-pop)',
                color: 'var(--color-ink)',
                boxShadow: 'var(--shadow-pop)',
                fontSize: 12.5,
              }}
              itemStyle={{ color: 'var(--color-ink)' }}
              labelFormatter={(m) => monthLabel(String(m))}
            />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                isAnimationActive={!still}
                dataKey={s.key}
                name={s.label}
                stackId="made"
                fill={s.color}
                // Only the top of the stack is rounded.
                radius={i === SERIES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
