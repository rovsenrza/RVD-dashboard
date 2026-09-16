import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DashboardSummary } from '@/entities/types'
import { Card } from '@/shared/ui'

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const monthLabel = (m: string) => MONTHS[Number(m.slice(5)) - 1] ?? m

export function ReplacementsChart({
  data,
  className,
}: {
  data: DashboardSummary['replacementsByMonth']
  className?: string
}) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <Card
      title="Замены по месяцам"
      action={<span className="text-[12.5px] text-ink-muted tabular">{total} за 12 мес.</span>}
      className={className}
    >
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
              cursor={{ fill: 'var(--color-brand-soft)', opacity: 0.6 }}
              contentStyle={{
                borderRadius: 10,
                border: 'none',
                boxShadow: 'var(--shadow-pop)',
                fontSize: 12.5,
              }}
              labelFormatter={(m) => monthLabel(String(m))}
              formatter={(v) => [v, 'Замен']}
            />
            <Bar dataKey="count" fill="var(--color-brand)" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
