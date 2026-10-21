import { useMemo, useState } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { subDays } from 'date-fns'
import type { AuditEntry, AuditTargetKind } from '@/entities/types'
import { AUDIT_ACTION_LABEL, AUDIT_TARGET_LABEL } from '@/entities/audit'
import { useAudit } from '@/shared/api/queries'
import { formatDateTime } from '@/shared/lib/utils'
import { DataTable, QueryState, SearchInput, Select, TableSkeleton } from '@/shared/ui'
import { AuditDialog } from './AuditDialog'

const col = createColumnHelper<AuditEntry>()

/** «Место установки: Ковш → Рукоять» — the first change, and how many more. */
function summary(e: AuditEntry) {
  const [first, ...rest] = e.changes
  if (!first) return null
  const text =
    first.before === null
      ? `${first.field}: ${first.after ?? '—'}`
      : `${first.field}: ${first.before} → ${first.after ?? '—'}`
  return rest.length ? `${text} и ещё ${rest.length}` : text
}

const columns = [
  col.accessor('at', {
    header: 'Когда',
    meta: { mobile: 'aside' },
    cell: (c) => <span className="text-ink-secondary tabular">{formatDateTime(c.getValue())}</span>,
  }),
  col.accessor((e) => e.actor.name, { id: 'actor', header: 'Кто' }),
  col.accessor((e) => AUDIT_ACTION_LABEL[e.action], { id: 'action', header: 'Действие' }),
  col.accessor((e) => e.target.label, {
    id: 'target',
    header: 'Объект',
    meta: { mobile: 'title' },
    cell: (c) => <span className="font-medium">{c.getValue()}</span>,
  }),
  col.accessor((e) => summary(e) ?? '', {
    id: 'changes',
    header: 'Изменения',
    cell: (c) => (
      <span className="block max-w-[28rem] truncate text-ink-secondary">{c.getValue() || '—'}</span>
    ),
  }),
] as ColumnDef<AuditEntry, unknown>[]

const PERIODS = [
  { value: '7', label: 'За 7 дней' },
  { value: '30', label: 'За 30 дней' },
  { value: '90', label: 'За 90 дней' },
  { value: 'all', label: 'За всё время' },
]

export function AuditTab() {
  const audit = useAudit()
  const [actor, setActor] = useState('')
  const [kind, setKind] = useState<AuditTargetKind | ''>('')
  const [period, setPeriod] = useState('30')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<AuditEntry | null>(null)

  const actors = useMemo(() => {
    const byId = new Map((audit.data ?? []).map((e) => [e.actor.id, e.actor.name]))
    return [...byId].sort((a, b) => a[1].localeCompare(b[1], 'ru'))
  }, [audit.data])

  const rows = useMemo(() => {
    const since = period === 'all' ? '' : subDays(new Date(), Number(period)).toISOString()
    return (audit.data ?? []).filter(
      (e) =>
        (!actor || e.actor.id === actor) &&
        (!kind || e.target.kind === kind) &&
        (!since || e.at >= since),
    )
  }, [audit.data, actor, kind, period])

  return (
    <>
      <QueryState query={audit} skeleton={<TableSkeleton />}>
        {() => (
          <DataTable
            data={rows}
            columns={columns}
            globalFilter={q}
            onRowClick={setOpen}
            emptyTitle="За выбранный период действий нет"
            toolbar={
              <div className="flex flex-wrap gap-2">
                <Select
                  aria-label="Кто"
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  placeholder="Все пользователи"
                  options={actors.map(([id, name]) => ({ value: id, label: name }))}
                  className="w-48"
                />
                <Select
                  aria-label="Что"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as AuditTargetKind | '')}
                  placeholder="Все объекты"
                  options={Object.entries(AUDIT_TARGET_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  className="w-44"
                />
                <Select
                  aria-label="Период"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  options={PERIODS}
                  className="w-40"
                />
              </div>
            }
            search={
              <SearchInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Объект, действие, изменения"
                aria-label="Поиск по журналу"
              />
            }
          />
        )}
      </QueryState>
      {open && <AuditDialog entry={open} onClose={() => setOpen(null)} />}
    </>
  )
}
