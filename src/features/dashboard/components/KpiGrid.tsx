import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Package, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import type { DashboardSummary } from '@/entities/types'
import { DASHBOARD_PERIOD_LABEL, dashboardPeriod } from '@/entities/dashboard'
import { KpiCard, KpiStrip } from '@/shared/ui'

export function KpiGrid({ data }: { data: DashboardSummary }) {
  const go = useNavigate()
  const period = DASHBOARD_PERIOD_LABEL[dashboardPeriod(data.periodDays)]
  const over = `за ${period}`
  return (
    <KpiStrip>
      <KpiCard
        label="Отгружено изделий"
        value={data.shippedTotal}
        delta={data.deltas.shippedTotal}
        deltaLabel={over}
        icon={Package}
        onClick={() => go('/products')}
      />
      <KpiCard
        label="В эксплуатации"
        value={data.inOperation}
        icon={Wrench}
        onClick={() => go('/products?installed=1')}
      />
      <KpiCard
        label="На гарантии"
        value={data.onWarranty}
        delta={data.deltas.onWarranty}
        deltaLabel={over}
        better="up"
        icon={ShieldCheck}
        tone="ok"
        onClick={() => go('/products?status=ok')}
      />
      <KpiCard
        label="Срок истекает"
        value={data.expiringSoon}
        icon={Clock}
        tone="warn"
        onClick={() => go('/products?status=warn')}
      />
      <KpiCard
        label="Требуют замены"
        value={data.needsReplacement}
        delta={data.deltas.needsReplacement}
        deltaLabel={over}
        better="down"
        icon={AlertTriangle}
        tone="replace"
        onClick={() => go('/products?status=replace')}
      />
      <KpiCard
        label={`Замен за ${period}`}
        value={data.replacementsInPeriod}
        delta={data.deltas.replacements}
        deltaLabel="к прошлому периоду"
        icon={RefreshCw}
        onClick={() => go(`/replacements?period=${data.periodDays}`)}
      />
    </KpiStrip>
  )
}
