import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Clock, Package, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import { useDashboard } from '@/shared/api/queries'
import { Card } from '@/shared/ui/Card'
import { KpiCard } from '@/shared/ui/KpiCard'
import { formatDate, STATUS_LABEL } from '@/shared/lib/utils'
import type { ProductStatus } from '@/entities/types'

const STATUS_COLOR: Record<ProductStatus, string> = {
  ok: 'var(--color-status-ok)',
  warn: 'var(--color-status-warn)',
  replace: 'var(--color-status-replace)',
  no_warranty: 'var(--color-status-none)',
}

export function DashboardPage() {
  const { data, isPending, error } = useDashboard()
  if (isPending) return <p className="text-ink-muted">Загрузка…</p>
  if (error) return <p className="text-status-replace">Ошибка: {error.message}</p>

  const pie = (Object.keys(data.statusBreakdown) as ProductStatus[]).map((k) => ({
    name: STATUS_LABEL[k],
    value: data.statusBreakdown[k],
    color: STATUS_COLOR[k],
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Главная</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Отгружено изделий"
          value={data.shippedTotal}
          delta={data.deltas.shippedTotal}
          icon={Package}
        />
        <KpiCard label="В эксплуатации" value={data.inOperation} icon={Wrench} />
        <KpiCard
          label="На гарантии"
          value={data.onWarranty}
          delta={data.deltas.onWarranty}
          icon={ShieldCheck}
          tone="ok"
        />
        <KpiCard label="Срок истекает" value={data.expiringSoon} icon={Clock} tone="warn" />
        <KpiCard
          label="На замену"
          value={data.needsReplacement}
          delta={data.deltas.needsReplacement}
          icon={AlertTriangle}
          tone="replace"
        />
        <KpiCard
          label="Замен за 30 дней"
          value={data.replacementsInPeriod}
          delta={data.deltas.replacements}
          icon={RefreshCw}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Замены по месяцам" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data.replacementsByMonth}>
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

        <Card title="Состояние изделий">
          <div className="flex items-center gap-4">
            <div className="h-40 w-40 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pie}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {pie.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1 text-sm">
              {pie.map((d) => (
                <li key={d.name} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-ink-muted">{d.name}</span>
                  <span className="ml-auto pl-3 font-medium tabular-nums">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <Card
        title="Ближайшие плановые замены"
        action={
          <Link to="/products" className="text-xs text-brand-dark hover:underline">
            Все изделия
          </Link>
        }
      >
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-muted">
            <tr>
              <th className="py-1 font-medium">EHS №</th>
              <th className="py-1 font-medium">Техника</th>
              <th className="py-1 font-medium">Плановая дата</th>
            </tr>
          </thead>
          <tbody>
            {data.upcoming.map((u) => (
              <tr key={u.productId} className="border-t border-line">
                <td className="py-1.5">
                  <Link to={`/products/${u.productId}`} className="text-brand-dark hover:underline">
                    {u.serialNumber}
                  </Link>
                </td>
                <td className="py-1.5">{u.equipment}</td>
                <td className="py-1.5 tabular-nums">{formatDate(u.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
