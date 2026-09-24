import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { BellOff, CheckCheck } from 'lucide-react'
import type { CabinetNotification, NotificationKind } from '@/entities/types'
import {
  NOTIFICATION_KIND_HINT,
  NOTIFICATION_KIND_LABEL,
  NOTIFICATION_KINDS,
  notificationTarget,
} from '@/entities/notification'
import { useSession } from '@/app/session'
import {
  useMarkRead,
  useNotificationPrefs,
  useNotifications,
  useSaveNotificationPrefs,
  useSettings,
} from '@/shared/api/queries'
import { plural } from '@/shared/lib/utils'
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  PageHeader,
  QueryState,
  Select,
  Skeleton,
  Tabs,
  useToast,
} from '@/shared/ui'
import { NotificationItem } from './NotificationItem'

type Tab = 'all' | 'unread'
const PAGE = 40

/** «Сегодня», «Вчера», «22 сентября, понедельник». */
const dayLabel = (iso: string) => {
  const d = parseISO(iso)
  if (isToday(d)) return 'Сегодня'
  if (isYesterday(d)) return 'Вчера'
  return format(d, 'd MMMM, EEEE', { locale: ru })
}

/**
 * «Уведомления» (Д19, ТЗ 3.6): what the daily check found for this user in the
 * branch scope, newest first and grouped by day, plus what they want to hear about.
 */
export function NotificationsPage() {
  const query = useNotifications()
  const read = useMarkRead()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'unread' ? 'unread' : 'all'
  const kind = NOTIFICATION_KINDS.find((k) => k === params.get('kind')) ?? null
  const [shown, setShown] = useState(PAGE)

  const all = query.data ?? []
  const unread = all.filter((n) => !n.read).length
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((n) => (tab === 'all' || !n.read) && (!kind || n.kind === kind)),
    [query.data, tab, kind],
  )

  const set = (key: string, value: string | null) => {
    if (value) params.set(key, value)
    else params.delete(key)
    setParams(params, { replace: true })
    setShown(PAGE)
  }

  const open = (n: CabinetNotification) => {
    if (!n.read) read.mutate([n.id])
    navigate(notificationTarget(n))
  }

  return (
    <>
      <PageHeader
        title="Уведомления"
        description="Каждое утро кабинет проверяет рукава и заявки по правилам и срокам из настроек компании"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={CheckCheck}
            disabled={!unread || read.isPending}
            onClick={() => read.mutate(undefined)}
          >
            Прочитать все
          </Button>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <Card padded={false} className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-5 pt-4">
            <Tabs
              items={[
                { key: 'all', label: 'Все', count: all.length },
                { key: 'unread', label: 'Непрочитанные', count: unread },
              ]}
              value={tab}
              onChange={(t) => set('tab', t === 'all' ? null : t)}
              className="border-b-0"
            />
            <Select
              aria-label="Правило"
              value={kind ?? ''}
              onChange={(e) => set('kind', e.target.value || null)}
              placeholder="Все правила"
              options={NOTIFICATION_KINDS.map((k) => ({
                value: k,
                label: NOTIFICATION_KIND_LABEL[k],
              }))}
              className="mb-2 max-sm:w-full sm:w-64"
            />
          </div>
          <div className="border-t border-line p-2">
            <QueryState
              query={query}
              skeleton={
                <div className="grid gap-2 p-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              }
            >
              {() =>
                rows.length ? (
                  <Groups rows={rows.slice(0, shown)} onOpen={open} />
                ) : (
                  <EmptyState
                    inset
                    icon={BellOff}
                    title={tab === 'unread' ? 'Всё прочитано' : 'Уведомлений нет'}
                    description={
                      tab === 'unread'
                        ? 'Новые появятся после утренней проверки.'
                        : 'За последние 30 дней ни одно правило не сработало.'
                    }
                  />
                )
              }
            </QueryState>
            {rows.length > shown && (
              <div className="p-3 pt-1">
                <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                  Показать ещё {Math.min(PAGE, rows.length - shown)}
                </Button>
              </div>
            )}
          </div>
        </Card>
        <PrefsCard />
      </div>
    </>
  )
}

function Groups({
  rows,
  onOpen,
}: {
  rows: CabinetNotification[]
  onOpen: (n: CabinetNotification) => void
}) {
  const groups: [string, CabinetNotification[]][] = []
  for (const n of rows) {
    const label = dayLabel(n.createdAt)
    const last = groups.at(-1)
    if (last?.[0] === label) last[1].push(n)
    else groups.push([label, [n]])
  }
  return (
    <div className="grid gap-3">
      {groups.map(([label, list]) => (
        <section key={label} aria-label={label}>
          <h2 className="px-3 pt-2 pb-1 text-caption font-medium tracking-wide text-ink-muted uppercase">
            {label}
          </h2>
          <ul>
            {list.map((n) => (
              <li key={n.id}>
                <NotificationItem n={n} onOpen={() => onOpen(n)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Per-user subscription; the lead days and whether e-mail is allowed belong to the company. */
function PrefsCard() {
  const { user } = useSession()
  const prefs = useNotificationPrefs()
  const save = useSaveNotificationPrefs()
  const toast = useToast()
  // Company settings are the administrator's to read; other roles see the general wording.
  const settings = useSettings(user.role === 'admin')
  const lead = user.role === 'admin' ? settings.data?.leadDays : undefined
  const last = lead?.at(-1) ?? 0

  const change = (patch: Parameters<typeof save.mutate>[0]) =>
    save.mutate(patch, { onError: () => toast('Не удалось сохранить настройку', 'error') })

  return (
    <Card title="Что присылать мне">
      <QueryState query={prefs} skeleton={<Skeleton className="h-56 w-full" />}>
        {(p) => (
          <>
            <fieldset className="grid gap-3">
              <legend className="sr-only">Правила</legend>
              {NOTIFICATION_KINDS.map((k: NotificationKind) => (
                <Checkbox
                  key={k}
                  label={NOTIFICATION_KIND_LABEL[k]}
                  hint={NOTIFICATION_KIND_HINT[k]}
                  checked={p.kinds[k]}
                  onChange={(e) => change({ kinds: { ...p.kinds, [k]: e.target.checked } })}
                />
              ))}
            </fieldset>
            <fieldset className="mt-5 grid gap-3 border-t border-line pt-4">
              <legend className="sr-only">Каналы</legend>
              <Checkbox label="В кабинете — колокольчик" hint="Включено всегда" checked disabled />
              <Checkbox
                label="На почту"
                hint={
                  p.companyEmail
                    ? `${p.address} · письма пойдут, когда подключат почтовый сервер компании`
                    : 'Администратор выключил письма для компании'
                }
                checked={p.email && p.companyEmail}
                disabled={!p.companyEmail}
                onChange={(e) => change({ email: e.target.checked })}
              />
            </fieldset>
            <p className="mt-5 border-t border-line pt-4 text-label text-ink-muted">
              {lead
                ? `Предупреждаем за ${lead.join(', ')} ${plural(last, 'день', 'дня', 'дней')} до срока. `
                : 'За сколько дней предупреждать, задаёт администратор кабинета. '}
              {user.role === 'admin' && (
                <Link to="/admin?tab=settings" className="text-brand-deep hover:underline">
                  Изменить сроки
                </Link>
              )}
            </p>
          </>
        )}
      </QueryState>
    </Card>
  )
}
