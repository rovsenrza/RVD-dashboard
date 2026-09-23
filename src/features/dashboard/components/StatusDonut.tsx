import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Link } from 'react-router-dom'
import type { ProductStatus } from '@/entities/types'
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '@/entities/product'
import { Card } from '@/shared/ui'
import { formatNumber } from '@/shared/lib/utils'

export function StatusDonut({ breakdown }: { breakdown: Record<ProductStatus, number> }) {
  const slices = STATUS_ORDER.map((k) => ({
    key: k,
    name: STATUS_LABEL[k],
    value: breakdown[k],
    color: STATUS_COLOR[k],
  }))
  const total = slices.reduce((s, x) => s + x.value, 0)
  return (
    <Card title="Состояние изделий">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
        <div className="relative h-36 w-36 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                innerRadius={48}
                outerRadius={68}
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                separator=": "
                // Above the centre total, which is a later sibling at z-10.
                wrapperStyle={{ zIndex: 20 }}
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
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-full text-center [clip-path:circle(46px)]">
            <div>
              <div className="text-title leading-none font-semibold tracking-[-0.02em] tabular">
                {formatNumber(total)}
              </div>
              <div className="mt-1 text-micro text-ink-muted">изделий</div>
            </div>
          </div>
        </div>
        <ul className="w-full min-w-0 flex-1 divide-y divide-line text-ui">
          {slices.map((s) => (
            <li key={s.key}>
              <Link
                to={`/products?status=${s.key}`}
                className="flex items-center gap-2.5 py-2 hover:text-brand-deep"
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="text-ink-secondary">{s.name}</span>
                <span className="ml-auto pl-3 font-medium tabular">{formatNumber(s.value)}</span>
                <span className="w-9 text-right text-ink-faint tabular">
                  {total ? Math.round((s.value / total) * 100) : 0}%
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
