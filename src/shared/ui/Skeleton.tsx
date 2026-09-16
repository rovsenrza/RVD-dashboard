import { cn } from '@/shared/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-line', className)} aria-hidden />
}

/** Table-shaped placeholder: header + N rows. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="space-y-2 rounded-xl border border-line bg-surface p-3"
      role="status"
      aria-label="Загрузка"
    >
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}

/** KPI grid placeholder. */
export function KpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      role="status"
      aria-label="Загрузка"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  )
}
