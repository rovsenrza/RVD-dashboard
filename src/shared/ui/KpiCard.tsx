import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn, formatNumber } from '@/shared/lib/utils'

/**
 * One cell of a KPI strip. Cells sit inside a single sheet divided by hairlines —
 * one object, not six cards.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaLabel = 'за 30 дней',
  icon: Icon,
  tone = 'default',
  onClick,
}: {
  label: string
  value: number
  delta?: number
  deltaLabel?: string
  icon: LucideIcon
  tone?: 'default' | 'ok' | 'warn' | 'replace'
  onClick?: () => void
}) {
  const toneClass = {
    default: 'text-ink',
    ok: 'text-status-ok-ink',
    warn: 'text-status-warn-ink',
    replace: 'text-status-replace-ink',
  }[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col gap-2 px-5 py-4 text-left',
        onClick && 'transition-colors duration-150 hover:bg-sheet-muted!',
      )}
    >
      {/*
        Labels wrap instead of truncating. Where cells are narrow (two columns on a phone,
        six up to 1536px) every label reserves two lines, so the numbers stay on one row.
      */}
      <div className="flex min-h-[2lh] items-start gap-2 text-label leading-snug text-ink-muted md:min-h-0 xl:min-h-[2lh] 2xl:min-h-0">
        <Icon size={15} strokeWidth={1.75} className="mt-px shrink-0 text-brand-dark" />
        <span className="line-clamp-2">{label}</span>
      </div>
      <div
        className={cn('text-kpi leading-none font-semibold tracking-[-0.02em] tabular', toneClass)}
      >
        {formatNumber(value)}
      </div>
      <div className="flex h-5 items-center gap-1.5 text-caption text-ink-muted">
        {delta !== undefined ? (
          <>
            <Delta value={delta} />
            <span>{deltaLabel}</span>
          </>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </div>
    </Tag>
  )
}

function Delta({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span
      className={cn(
        'rounded-md px-1.5 leading-5 font-medium tabular',
        up
          ? 'bg-status-ok-soft text-status-ok-ink'
          : 'bg-status-replace-soft text-status-replace-ink',
      )}
    >
      {up ? '+' : ''}
      {value}
    </span>
  )
}

export function KpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sheet grid grid-cols-2 gap-px overflow-hidden bg-line md:grid-cols-3 xl:grid-cols-6 [&>*]:bg-sheet',
        className,
      )}
    >
      {children}
    </div>
  )
}
