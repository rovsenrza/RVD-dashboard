import { useDashboard } from '@/shared/api/queries'
import { KpiSkeleton, PageHeader, QueryState, Skeleton } from '@/shared/ui'
import { KpiGrid } from './components/KpiGrid'
import { ReplacementsChart } from './components/ReplacementsChart'
import { StatusDonut } from './components/StatusDonut'
import { UpcomingTable } from './components/UpcomingTable'

export function DashboardPage() {
  const query = useDashboard()
  return (
    <div className="space-y-6">
      <PageHeader title="Главная" />
      <QueryState query={query} skeleton={<DashboardSkeleton />}>
        {(data) => (
          <>
            <KpiGrid data={data} />
            <div className="grid gap-4 lg:grid-cols-3">
              <ReplacementsChart data={data.replacementsByMonth} className="lg:col-span-2" />
              <StatusDonut breakdown={data.statusBreakdown} />
            </div>
            <UpcomingTable rows={data.upcoming} />
          </>
        )}
      </QueryState>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <KpiSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
