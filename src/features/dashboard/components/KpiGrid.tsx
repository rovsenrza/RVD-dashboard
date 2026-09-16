import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Package, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import type { DashboardSummary } from '@/entities/types'
import { KpiCard, KpiStrip } from '@/shared/ui'

export function KpiGrid({ data }: { data: DashboardSummary }) {
  const go = useNavigate()
  return (
    <KpiStrip>
      <KpiCard
        label="Отгружено изделий"
        value={data.shippedTotal}
        delta={data.deltas.shippedTotal}
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
        icon={AlertTriangle}
        tone="replace"
        onClick={() => go('/products?status=replace')}
      />
      <KpiCard
        label="Замен за 30 дней"
        value={data.replacementsInPeriod}
        delta={data.deltas.replacements}
        icon={RefreshCw}
        onClick={() => go('/replacements')}
      />
    </KpiStrip>
  )
}
