import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Equipment, ProductStatus } from '@/entities/types'
import { ProductStatusBar } from '@/entities/product'
import { useSession } from '@/app/session'
import { cn, formatDate, plural } from '@/shared/lib/utils'
import { Button, EmptyState, EmptyValue } from '@/shared/ui'
import { HosesByPlace } from './HosesByPlace'

const NO_DEPARTMENT = 'Без подразделения'
const hosesWord = (n: number) => `${n} РВД`
const machinesWord = (n: number) => `${n} ${plural(n, 'машина', 'машины', 'машин')}`

const sum = (list: Equipment[]) => {
  const total: Record<ProductStatus, number> = { ok: 0, warn: 0, replace: 0, no_warranty: 0 }
  for (const e of list)
    for (const k of Object.keys(total) as ProductStatus[]) total[k] += e.statusBreakdown[k]
  return total
}

/** Attention first: machines with hoses to replace, then to watch, then by garage number. */
const byAttention = (a: Equipment, b: Equipment) =>
  b.statusBreakdown.replace - a.statusBreakdown.replace ||
  b.statusBreakdown.warn - a.statusBreakdown.warn ||
  a.garageNumber.localeCompare(b.garageNumber, 'ru')

function group<T>(list: T[], key: (x: T) => string) {
  const map = new Map<string, T[]>()
  for (const x of list) map.set(key(x), [...(map.get(key(x)) ?? []), x])
  return [...map]
}

/**
 * Компания → Филиал → Подразделение → Техника → Место установки → РВД (Д12).
 * Departments open by default; a machine opens to its hoses by place. The
 * machine's number goes to its card; the chevron only unfolds the row.
 */
export function EquipmentTree({ machines }: { machines: Equipment[] }) {
  const { branches } = useSession()
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set)
    if (!next.delete(key)) next.add(key)
    return next
  }

  if (!machines.length)
    return <EmptyState title="Ничего не нашлось" description="Измените запрос поиска." />

  const byBranch = group(machines, (e) => e.branchId)
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id

  return (
    <div className="grid gap-5">
      {byBranch.map(([branchId, inBranch]) => (
        <section key={branchId} aria-label={branchName(branchId)} className="sheet">
          {byBranch.length > 1 && (
            <h2 className="px-5 pt-4 text-sheet-title font-semibold tracking-[-0.01em]">
              {branchName(branchId)}
            </h2>
          )}
          {group(inBranch, (e) => e.department ?? NO_DEPARTMENT)
            .sort(([a], [b]) =>
              a === NO_DEPARTMENT ? 1 : b === NO_DEPARTMENT ? -1 : a.localeCompare(b, 'ru'),
            )
            .map(([department, list]) => {
              const key = `${branchId}/${department}`
              const expanded = !closed.has(key)
              const hoses = list.reduce((s, e) => s + e.hoseCount, 0)
              return (
                <div key={key} className="border-b border-line px-3 py-2 last:border-b-0 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-1.5">
                    <Button
                      variant="ghost"
                      size="auto"
                      aria-expanded={expanded}
                      onClick={() => setClosed((s) => toggle(s, key))}
                      className="-ml-2 h-auto gap-2 px-2 py-1"
                    >
                      <ChevronRight
                        size={16}
                        strokeWidth={1.75}
                        className={cn('transition-transform duration-150', expanded && 'rotate-90')}
                      />
                      <span className="text-sm font-semibold text-ink">{department}</span>
                    </Button>
                    <span className="text-label text-ink-muted">
                      {machinesWord(list.length)} · {hosesWord(hoses)}
                    </span>
                    <div className="w-full sm:ml-auto sm:w-56">
                      <ProductStatusBar breakdown={sum(list)} />
                    </div>
                  </div>
                  {expanded && (
                    <ul className="mb-2 divide-y divide-line">
                      {[...list].sort(byAttention).map((e) => (
                        <Machine
                          key={e.id}
                          e={e}
                          open={open.has(e.id)}
                          onToggle={() => setOpen((s) => toggle(s, e.id))}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
        </section>
      ))}
    </div>
  )
}

function Machine({ e, open, onToggle }: { e: Equipment; open: boolean; onToggle: () => void }) {
  return (
    <li>
      <div className="grid grid-cols-[2rem_1fr] items-center gap-x-2 gap-y-1.5 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_7rem_8rem_14rem] sm:pl-4">
        <Button
          variant="ghost"
          size="icon-sm"
          icon={ChevronRight}
          aria-expanded={open}
          aria-label={open ? `Свернуть ${e.garageNumber}` : `Показать РВД на ${e.garageNumber}`}
          onClick={onToggle}
          disabled={!e.hoseCount}
          className={cn(
            '[&_svg]:transition-transform [&_svg]:duration-150',
            open && '[&_svg]:rotate-90',
          )}
        />
        <div className="min-w-0 text-ui">
          <Link to={`/equipment/${e.id}`} className="font-medium text-brand-deep hover:underline">
            {e.garageNumber}
          </Link>
          <span className="text-ink-secondary">
            {' '}
            · {e.brand} {e.model}
          </span>
          <span className="block text-label text-ink-muted">{e.type}</span>
        </div>
        <span className="text-label text-ink-muted max-sm:col-start-2 sm:text-ui sm:text-ink">
          {hosesWord(e.hoseCount)}
        </span>
        <span className="text-label text-ink-muted tabular max-sm:col-start-2">
          {e.nextPlannedReplacement ? (
            <>
              <span className="sm:hidden">Ближайшая замена </span>
              {formatDate(e.nextPlannedReplacement)}
            </>
          ) : (
            <EmptyValue />
          )}
        </span>
        <div className="max-sm:col-start-2">
          <ProductStatusBar breakdown={e.statusBreakdown} />
        </div>
      </div>
      {open && (
        <div className="mb-3 ml-10 rounded-lg bg-field px-4 py-3 sm:ml-14">
          <HosesByPlace equipmentId={e.id} />
        </div>
      )}
    </li>
  )
}
