import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DashboardSummary } from '@/entities/types'
import { Card } from '@/shared/ui'

export function ReplacementsChart({
  data,
  className,
}: {
  data: DashboardSummary['replacementsByMonth']
  className?: string
}) {
  return (
    <Card title="Замены по месяцам" className={className}>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              tickFormatter={(m: string) => m.slice(5)}
            />
            <YAxis width={28} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
