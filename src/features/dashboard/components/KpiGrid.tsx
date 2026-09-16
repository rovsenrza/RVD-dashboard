import { AlertTriangle, Clock, Package, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import type { DashboardSummary } from '@/entities/types'
import { KpiCard } from '@/shared/ui'

export function KpiGrid({ data }: { data: DashboardSummary }) {
  return (
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
  )
}
