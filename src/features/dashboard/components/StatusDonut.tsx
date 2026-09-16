import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ProductStatus } from '@/entities/types'
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '@/entities/product'
import { Card } from '@/shared/ui'

export function StatusDonut({ breakdown }: { breakdown: Record<ProductStatus, number> }) {
  const slices = STATUS_ORDER.map((k) => ({
    key: k,
    name: STATUS_LABEL[k],
    value: breakdown[k],
    color: STATUS_COLOR[k],
  }))
  return (
    <Card title="Состояние изделий">
      <div className="flex items-center gap-4">
        <div className="h-40 w-40 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={slices} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {slices.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1 text-sm">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-ink-muted">{s.name}</span>
              <span className="ml-auto pl-3 font-medium tabular-nums">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
