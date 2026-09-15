import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: number
  delta?: number
  icon: LucideIcon
  tone?: 'default' | 'ok' | 'warn' | 'replace'
}) {
  const toneClass = {
    default: 'text-ink',
    ok: 'text-status-ok',
    warn: 'text-status-warn',
    replace: 'text-status-replace',
  }[tone]
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Icon size={14} className="text-brand" />
        {label}
      </div>
      <div className={cn('mt-2 text-3xl font-semibold tabular-nums', toneClass)}>
        {value.toLocaleString('ru-RU')}
      </div>
      {delta !== undefined && (
        <div className="mt-1 text-xs text-ink-muted">
          <span className={delta >= 0 ? 'text-status-ok' : 'text-status-replace'}>
            {delta >= 0 ? '+' : ''}
            {delta}
          </span>{' '}
          за последние 30 дней
        </div>
      )}
    </div>
  )
}
