import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = 'Назад',
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="space-y-2">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-xl font-semibold text-balance">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
