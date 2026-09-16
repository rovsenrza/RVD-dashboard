import type { ReactNode } from 'react'
import { AlertCircle, Inbox, type LucideIcon } from 'lucide-react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Button } from './Button'

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Нет данных',
  description,
  action,
}: {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-12 text-center">
      <Icon size={28} className="text-ink-muted/60" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-ink-muted">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-status-replace/30 bg-status-replace/5 px-4 py-10 text-center">
      <AlertCircle size={28} className="text-status-replace" />
      <p className="text-sm font-medium">Не удалось загрузить данные</p>
      {message && <p className="text-xs text-ink-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
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
