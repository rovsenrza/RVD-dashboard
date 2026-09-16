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
    <div className="mb-5 space-y-2">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-balance">
            {title}
          </h1>
          {description && <p className="mt-1 text-[13.5px] text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
