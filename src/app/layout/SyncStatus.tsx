import { CloudOff, RefreshCw } from 'lucide-react'
import { useSession } from '@/app/session'
import { useRunSync, useSyncStatus } from '@/shared/api/queries'
import { Button, Tooltip } from '@/shared/ui'
import { cn } from '@/shared/lib/utils'
import { isUnavailable, syncTime as when } from './syncState'

const ABOUT =
  'Кабинет показывает данные 1С: изменения подтягиваются каждые несколько минут, всё целиком — ночью.'

/**
 * «Данные 1С на 14:32» at the foot of the rail (Д26), where the shell already
 * names its source: the dot turns to «внимание» while 1С is silent, and an
 * administrator gets a button to check 1С now.
 */
export function SyncFooter() {
  const { user } = useSession()
  const status = useSyncStatus()
  const run = useRunSync()
  const s = status.data
  const down = isUnavailable(s)
  const running = Boolean(s?.running) || run.isPending
  const text = !s
    ? 'Данные 1С'
    : running
      ? 'Обновляем данные 1С…'
      : s.syncedAt
        ? `Данные 1С на ${when(s.syncedAt)}`
        : 'Данных 1С ещё нет'

  return (
    <div className="flex h-7 items-center gap-1">
      <Tooltip content={ABOUT} className="min-w-0 flex-1">
        <span tabIndex={0} className="flex items-center gap-2 rounded-sm tabular">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              down ? 'bg-status-warn' : s?.syncedAt ? 'bg-status-ok' : 'bg-status-none',
            )}
          />
          <span className="truncate">{text}</span>
        </span>
      </Tooltip>
      {user.role === 'admin' && s && (
        <Button
          variant="rail"
          size="icon-sm"
          icon={RefreshCw}
          className={cn('size-7 shrink-0', running && '[&_svg]:motion-safe:animate-spin')}
          disabled={running}
          onClick={() => run.mutate()}
          aria-label="Обновить данные из 1С сейчас"
        />
      )}
    </div>
  )
}

/**
 * Under the header while 1С does not answer: the cabinet keeps working on the
 * data it has, and says how old it is and what happens to new requests.
 */
export function SyncBanner() {
  const { user } = useSession()
  const status = useSyncStatus()
  const run = useRunSync()
  const s = status.data
  if (!s || !isUnavailable(s)) return null
  const running = s.running || run.isPending
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-status-warn-soft px-4 py-2.5 text-status-warn-ink lg:px-8"
    >
      <p className="flex min-w-0 flex-1 items-start gap-2.5 text-ui max-sm:basis-full">
        <CloudOff size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <span>
          <span className="font-medium">1С не отвечает с {when(s.unavailableSince!)}.</span>{' '}
          {s.syncedAt ? `Показаны данные на ${when(s.syncedAt)}` : 'Данных из 1С ещё нет'} — заявки
          принимаются и уйдут в 1С, как только связь вернётся.
        </span>
      </p>
      {user.role === 'admin' && (
        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          className="text-status-warn-ink hover:text-status-warn-ink max-sm:ml-6.5"
          disabled={running}
          onClick={() => run.mutate()}
        >
          {running ? 'Проверяем…' : 'Проверить снова'}
        </Button>
      )}
    </div>
  )
}
