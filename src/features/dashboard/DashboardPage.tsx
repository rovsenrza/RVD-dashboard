import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { useSession } from '@/app/session'
import {
  DASHBOARD_PERIOD_LABEL,
  DASHBOARD_PERIODS,
  type DashboardPeriod,
} from '@/entities/dashboard'
import type { DashboardSummary } from '@/entities/types'
import { useDashboard } from '@/shared/api/queries'
import type { ExportColumn } from '@/shared/lib/export'
import {
  Button,
  ExportMenu,
  KpiSkeleton,
  Menu,
  PageHeader,
  QueryState,
  Skeleton,
} from '@/shared/ui'
import { KpiGrid } from './components/KpiGrid'
import { ReplacementsChart } from './components/ReplacementsChart'
import { StatusDonut } from './components/StatusDonut'
import { UpcomingTable } from './components/UpcomingTable'

type Upcoming = DashboardSummary['upcoming'][number]
const UPCOMING_COLUMNS: ExportColumn<Upcoming>[] = [
  { header: 'EHS №', value: (u) => u.serialNumber, width: 12 },
  { header: 'Техника', value: (u) => u.equipment, width: 14 },
  { header: 'Плановая замена', value: (u) => u.dueDate, type: 'date', width: 14 },
]

export function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>(30)
  const query = useDashboard(period)
  const { branch } = useSession()
  const data = query.data

  return (
    <div>
      <PageHeader
        title="Главная"
        description={`${branch?.name ?? 'Все филиалы'} · сводка по изделиям и технике`}
        actions={
          <>
            <Menu
              trigger={() => (
                <Button variant="secondary" size="sm" icon={Calendar}>
                  {DASHBOARD_PERIOD_LABEL[period]}
                </Button>
              )}
              items={DASHBOARD_PERIODS.map((p) => ({
                label: DASHBOARD_PERIOD_LABEL[p],
                onSelect: () => setPeriod(p),
              }))}
            />
            {/* The summary's figures as lines above the nearest replacements, the table people act on. */}
            <ExportMenu
              fileName="сводка"
              title="Сводка по изделиям и технике"
              lines={
                data && [
                  branch?.name ?? 'Все филиалы',
                  `Период: ${DASHBOARD_PERIOD_LABEL[period]}`,
                  `Отгружено изделий: ${data.shippedTotal}`,
                  `В эксплуатации: ${data.inOperation}`,
                  `На гарантии: ${data.onWarranty}`,
                  `Срок истекает: ${data.expiringSoon}`,
                  `Требуют замены: ${data.needsReplacement}`,
                  `Замен за период: ${data.replacementsInPeriod}`,
                  'Ближайшие плановые замены:',
                ]
              }
              columns={UPCOMING_COLUMNS}
              rows={() => data?.upcoming ?? []}
            />
          </>
        }
      />
      <QueryState query={query} skeleton={<DashboardSkeleton />}>
        {(data) => (
          <div className="space-y-5">
            <KpiGrid data={data} />
            <div className="grid gap-5 lg:grid-cols-3">
              <ReplacementsChart data={data.replacementsByMonth} className="lg:col-span-2" />
              <StatusDonut breakdown={data.statusBreakdown} />
            </div>
            <UpcomingTable rows={data.upcoming} />
          </div>
        )}
      </QueryState>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <KpiSkeleton />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="sheet h-72 lg:col-span-2" />
        <Skeleton className="sheet h-72" />
      </div>
      <Skeleton className="sheet h-64" />
    </div>
  )
}
