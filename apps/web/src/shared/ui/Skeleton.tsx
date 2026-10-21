import { cn } from '@/shared/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-line/70', className)} aria-hidden />
}

/** Table-shaped placeholder: header + N rows, inside a sheet. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="sheet space-y-3 p-5" role="status" aria-label="Загрузка">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  )
}

/** KPI strip placeholder. */
export function KpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="sheet grid grid-cols-2 gap-px md:grid-cols-3 xl:grid-cols-6"
      role="status"
      aria-label="Загрузка"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2 p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  )
}
