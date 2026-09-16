import type { ReactNode } from 'react'
import { AlertCircle, Inbox, type LucideIcon } from 'lucide-react'
import type { UseQueryResult } from '@tanstack/react-query'
import { cn } from '@/shared/lib/utils'
import { Button } from './Button'

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Пока пусто',
  description,
  action,
  inset = false,
}: {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: ReactNode
  /** Rendered inside a sheet already: no own surface. */
  inset?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-4 text-center',
        inset ? 'py-10' : 'sheet py-14',
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-field text-ink-muted">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <p className="mt-1 text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="sheet flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-status-replace-soft text-status-replace">
        <AlertCircle size={20} strokeWidth={1.75} />
      </span>
      <p className="mt-1 text-sm font-medium">Не удалось загрузить данные</p>
      {message && <p className="max-w-md text-[13px] text-ink-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          Повторить
        </Button>
      )}
    </div>
  )
}

/**
 * Renders skeleton / error / empty / content for a TanStack query.
 * Keeps pages free of repeated isPending/error branches.
 */
export function QueryState<T>({
  query,
  skeleton,
  isEmpty,
  empty,
  children,
}: {
  query: UseQueryResult<T>
  skeleton: ReactNode
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
  children: (data: T) => ReactNode
}) {
  if (query.isPending) return <>{skeleton}</>
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyState />}</>
  return <>{children(query.data)}</>
}
