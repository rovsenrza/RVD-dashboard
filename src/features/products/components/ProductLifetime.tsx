import { differenceInDays, formatISO, parseISO } from 'date-fns'
import { CalendarClock } from 'lucide-react'
import type { LifetimePhase, ProductLifetime as Lifetime, ProductStatus } from '@/entities/types'
import { STATUS_COLOR } from '@/entities/product'
import { useProductLifetime } from '@/shared/api/queries'
import { cn, formatDate } from '@/shared/lib/utils'
import { Card, EmptyState, QueryState, Skeleton, Tooltip } from '@/shared/ui'

/** Phase names as a life stage, not as the badge on the hose today. */
const PHASE_LABEL: Record<ProductStatus, string> = {
  ok: 'На гарантии',
  no_warranty: 'После гарантии',
  warn: 'Внимание',
  replace: 'Пора менять',
}
const SOFT: Record<ProductStatus, string> = {
  ok: 'var(--color-status-ok-soft)',
  no_warranty: 'var(--color-status-none-soft)',
  warn: 'var(--color-status-warn-soft)',
  replace: 'var(--color-status-replace-soft)',
}

const days = (from: string, to: string) => differenceInDays(parseISO(to), parseISO(from))
const today = () => formatISO(new Date(), { representation: 'date' })
const range = (p: LifetimePhase) =>
  p.to ? `${formatDate(p.from)} — ${formatDate(p.to)}` : `с ${formatDate(p.from)}`

/**
 * «Срок службы» (Д11): the hose's life as one bar of phases on a time axis.
 * Lived time is solid, what is ahead is the soft tint of the same phase; the
 * marker is today, or the day it came off the machine. Colour is never alone:
 * the legend names each phase with its dates and marks the current one.
 */
export function ProductLifetime({ productId }: { productId: string }) {
  const query = useProductLifetime(productId)
  return (
    <Card title="Срок службы" className="lg:col-span-2">
      <QueryState query={query} skeleton={<Skeleton className="h-28 w-full" />}>
        {(life) =>
          life ? (
            <Timeline life={life} />
          ) : (
            <EmptyState
              inset
              icon={CalendarClock}
              title="Изделие не установлено"
              description="Срок службы начнётся с даты установки — её можно указать в «Изменить»."
            />
          )
        }
      </QueryState>
    </Card>
  )
}

function Timeline({ life }: { life: Lifetime }) {
  const now = life.endedAt ?? today()
  const lifeDays = days(life.startedAt, life.plannedAt)
  // Room after the planned date for the «пора менять» stretch, or up to today when overdue.
  const tail = Math.max(30, Math.round(lifeDays * 0.12))
  const total = Math.max(lifeDays + tail, days(life.startedAt, now) + 14)
  const at = (date: string) =>
    Math.min(100, Math.max(0, (days(life.startedAt, date) / total) * 100))
  const nowAt = at(now)

  const age = days(life.startedAt, now)
  const left = days(now, life.plannedAt)
  const current = life.phases.find((p) => p.from <= now && (!p.to || now < p.to)) ?? life.phases[0]
  const warrantyOver = life.warrantyUntil <= now

  return (
    <div>
      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        <Stat
          label={life.endedAt ? 'Прослужило' : life.basis === 'shipped' ? 'С отгрузки' : 'В работе'}
          value={`${age.toLocaleString('ru-RU')} дн.`}
        />
        {life.endedAt ? (
          <Stat label="Снято" value={formatDate(life.endedAt)!} />
        ) : (
          <Stat
            label="До плановой замены"
            value={
              left < 0
                ? `просрочено на ${(-left).toLocaleString('ru-RU')} дн.`
                : `${left.toLocaleString('ru-RU')} дн.`
            }
            className={left < 0 ? 'text-status-replace-ink' : undefined}
          />
        )}
        <Stat
          label="Гарантия"
          value={`${warrantyOver ? 'истекла' : 'до'} ${formatDate(life.warrantyUntil)}`}
        />
        <Stat label="Плановая замена" value={formatDate(life.plannedAt)!} />
      </dl>

      <div className="relative mt-9 mb-3">
        <div
          role="img"
          aria-label={`${life.phases.map((p) => `${PHASE_LABEL[p.status]}: ${range(p)}`).join('; ')}. ${life.endedAt ? `Снято ${formatDate(life.endedAt)}` : `Сегодня — ${PHASE_LABEL[current.status].toLowerCase()}`}.`}
          className="flex h-2.5 gap-0.5"
        >
          {life.phases.map((p) => {
            const from = at(p.from)
            const to = p.to ? at(p.to) : 100
            const width = to - from
            if (width <= 0) return null
            // Where «now» falls inside this phase, as a share of it: solid before, soft after.
            const split = Math.min(100, Math.max(0, ((nowAt - from) / width) * 100))
            return (
              <Tooltip
                key={p.status}
                content={`${PHASE_LABEL[p.status]}: ${range(p)}`}
                className="flex first:[&>*]:rounded-l-full last:[&>*]:rounded-r-full"
                style={{ width: `${width}%` }}
              >
                <span
                  className="block h-full flex-1 [print-color-adjust:exact]"
                  style={{
                    background: `linear-gradient(to right, ${STATUS_COLOR[p.status]} ${split}%, ${SOFT[p.status]} ${split}%)`,
                  }}
                />
              </Tooltip>
            )
          })}
        </div>
        <Marker at={nowAt} label={life.endedAt ? `Снято ${formatDate(life.endedAt)}` : 'Сегодня'} />
      </div>

      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
        {life.phases.map((p) => {
          const here = p === current
          return (
            <li key={p.status} className="flex items-start gap-2 text-label">
              <span
                className="mt-1 size-2.5 shrink-0 rounded-sm"
                style={{ background: STATUS_COLOR[p.status] }}
              />
              <span>
                <span className={cn('text-ink', here && 'font-medium')}>
                  {PHASE_LABEL[p.status]}
                  {here && !life.endedAt && ' · сейчас'}
                </span>
                <span className="block text-ink-muted tabular">{range(p)}</span>
              </span>
            </li>
          )
        })}
      </ul>

      {life.basis === 'shipped' && (
        <p className="mt-4 text-label text-ink-muted">
          Дата установки не указана — срок считается от отгрузки {formatDate(life.startedAt)}.
          Укажите установку в «Изменить», и срок пересчитается.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-label text-ink-muted">{label}</dt>
      <dd className={cn('mt-0.5 text-heading font-semibold tracking-[-0.01em] tabular', className)}>
        {value}
      </dd>
    </div>
  )
}

/** A thin ink line across the track with its label above; the label hugs the edge near the ends. */
function Marker({ at, label }: { at: number; label: string }) {
  const edge = at < 10 ? 'start' : at > 90 ? 'end' : 'middle'
  return (
    <div
      className="pointer-events-none absolute inset-y-0 w-0"
      style={{ left: `${at}%` }}
      aria-hidden
    >
      <span className="absolute -top-1.5 -bottom-1.5 -left-px w-0.5 rounded-full bg-ink" />
      <span
        className={cn(
          'absolute -top-7 text-caption font-medium whitespace-nowrap text-ink',
          edge === 'start' && 'left-0 -translate-x-px',
          edge === 'middle' && '-translate-x-1/2',
          edge === 'end' && 'right-0 translate-x-px',
        )}
      >
        {label}
      </span>
    </div>
  )
}
