import { useState } from 'react'
import { Calendar, Download } from 'lucide-react'
import { useSession } from '@/app/session'
import { useDashboard } from '@/shared/api/queries'
import { Button, KpiSkeleton, Menu, PageHeader, QueryState, Skeleton } from '@/shared/ui'
import { KpiGrid } from './components/KpiGrid'
import { ReplacementsChart } from './components/ReplacementsChart'
import { StatusDonut } from './components/StatusDonut'
import { UpcomingTable } from './components/UpcomingTable'

const PERIODS = ['30 дней', '90 дней', '12 месяцев'] as const

export function DashboardPage() {
  const query = useDashboard()
  const { branch } = useSession()
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('30 дней')

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
                  {period}
                </Button>
              )}
              items={PERIODS.map((p) => ({ label: p, onSelect: () => setPeriod(p) }))}
            />
            <Button variant="secondary" size="sm" icon={Download}>
              Экспорт
            </Button>
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
