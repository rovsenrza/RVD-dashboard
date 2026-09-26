import { differenceInDays, formatISO, parseISO } from 'date-fns'
import type {
  Product,
  ProductStatus,
  Report,
  ReportColumn,
  ReportId,
  ReportValue,
} from '@/entities/types'
import { LIFECYCLE_LABEL } from '@/entities/product'
import { serviceDates } from '@/entities/product/rules'
import { USAGE_UNIT_LABEL } from '@/entities/replacement'
import { reportMeta } from '@/entities/report'
import { branchSummaries, equipment, products, replacements, requests, settings } from './data'

export interface ReportParams {
  branch: string | null
  from: string | null
  to: string | null
}

type Row = Record<string, ReportValue>

const day = (d: Date) => formatISO(d, { representation: 'date' })
const col = (
  key: string,
  header: string,
  type: ReportColumn['type'] = 'text',
  width?: number,
): ReportColumn => ({ key, header, type, width })

const notRetired = (p: Product) => p.lifecycle !== 'written_off'
const installed = (p: Product) => p.installedAt !== null && notRetired(p)
const plannedAt = (p: Product) => (p.installedAt ? serviceDates(p, settings)!.plannedAt : null)
const machineOf = (p: Product) => equipment.find((e) => e.id === p.equipmentId) ?? null
const STATUS_KEYS: ProductStatus[] = ['ok', 'warn', 'replace', 'no_warranty']

/** The hose identity every hose report starts with. */
const hoseCells = (p: Product) => ({
  serial: p.serialNumber,
  catalog: p.catalogNumber,
  machine: machineOf(p)?.garageNumber ?? null,
  place: p.installPlace,
})
const HOSE_COLUMNS = [
  col('serial', 'EHS №', 'text', 10),
  col('catalog', 'Каталожный №', 'text', 16),
  col('machine', 'Техника', 'text', 10),
  col('place', 'Место установки', 'text', 20),
]

/** Sum the countable columns; the first column carries the «Итого» label. */
function totalsOf(columns: ReportColumn[], rows: Row[]): Row {
  const totals: Row = { [columns[0].key]: 'Итого' }
  for (const c of columns.slice(1))
    if (c.type === 'number') totals[c.key] = rows.reduce((s, r) => s + Number(r[c.key] ?? 0), 0)
  return totals
}

function statusCounts(hoses: Product[]) {
  const counts = Object.fromEntries(STATUS_KEYS.map((s) => [s, 0])) as Record<ProductStatus, number>
  for (const p of hoses) counts[p.status]++
  return counts
}
const STATUS_COLUMNS = [
  col('ok', 'Норма', 'number', 8),
  col('warn', 'Внимание', 'number', 9),
  col('replace', 'Замена', 'number', 8),
  col('no_warranty', 'Без гарантии', 'number', 10),
]

/**
 * What the BFF will compute from its Postgres cache (Д21): every row in the
 * branch scope, sorted the way the report is read, with totals where they add up.
 */
export function buildReport(id: ReportId, { branch, from, to }: ReportParams): Report | null {
  const meta = reportMeta(id)
  if (!meta) return null
  const today = day(new Date())
  const period = meta.period && from && to ? { from, to } : null
  const inBranch = <T extends { branchId: string }>(rows: T[]) =>
    branch ? rows.filter((r) => r.branchId === branch) : rows
  const hoses = inBranch(products)
  const machines = inBranch(equipment)
  const machineIds = new Set(machines.map((m) => m.id))
  const inPeriod = (date: string) => !period || (date >= period.from && date <= period.to)
  const swaps = replacements.filter((r) => machineIds.has(r.equipmentId) && inPeriod(r.date))

  let columns: ReportColumn[]
  let rows: Row[]
  let totals: Row | null = null

  switch (id) {
    case 'registry':
      columns = [
        ...HOSE_COLUMNS,
        col('installed', 'Установлено', 'date', 11),
        col('status', 'Состояние', 'status', 16),
        col('left', 'До плановой замены, дн.', 'number', 12),
        col('lifecycle', 'Статус в 1С', 'text', 16),
      ]
      rows = hoses
        .filter(notRetired)
        // By machine, so a printed page reads machine by machine; stock last.
        .map((p) => ({
          ...hoseCells(p),
          installed: p.installedAt,
          status: p.installedAt ? p.status : null,
          left: p.installedAt ? differenceInDays(parseISO(plannedAt(p)!), parseISO(today)) : null,
          lifecycle: LIFECYCLE_LABEL[p.lifecycle],
        }))
        .sort(
          (a, b) =>
            Number(a.machine === null) - Number(b.machine === null) ||
            String(a.machine ?? '').localeCompare(String(b.machine ?? ''), 'ru') ||
            String(a.serial).localeCompare(String(b.serial)),
        )
      break

    case 'warranty':
      columns = [
        ...HOSE_COLUMNS,
        col('installed', 'Установлено', 'date', 11),
        col('until', 'Гарантия до', 'date', 11),
        col('left', 'Осталось, дн.', 'number', 10),
      ]
      rows = hoses
        .filter(installed)
        .map((p) => ({ p, until: serviceDates(p, settings)!.warrantyUntil }))
        .filter(({ until }) => until >= today)
        .sort((a, b) => a.until.localeCompare(b.until))
        .map(({ p, until }) => ({
          ...hoseCells(p),
          installed: p.installedAt,
          until,
          left: differenceInDays(parseISO(until), parseISO(today)),
        }))
      break

    case 'due':
      columns = [
        ...HOSE_COLUMNS,
        col('installed', 'Установлено', 'date', 11),
        col('planned', 'Плановая замена', 'date', 12),
        col('overdue', 'Просрочено, дн.', 'number', 10),
      ]
      rows = hoses
        .filter((p) => installed(p) && p.status === 'replace')
        .map((p) => ({
          ...hoseCells(p),
          installed: p.installedAt,
          planned: plannedAt(p),
          overdue: differenceInDays(parseISO(today), parseISO(plannedAt(p)!)),
        }))
        .sort((a, b) => Number(b.overdue) - Number(a.overdue))
      break

    case 'plan':
      columns = [
        col('planned', 'Плановая замена', 'date', 12),
        ...HOSE_COLUMNS,
        col('type', 'Тип', 'text', 12),
        col('status', 'Состояние', 'status', 16),
      ]
      rows = hoses
        .filter(installed)
        .map((p) => ({ p, planned: plannedAt(p)! }))
        // Due inside the period, or already overdue: both have to be ordered now.
        .filter(
          ({ planned }) =>
            (!period || planned <= period.to) && (inPeriod(planned) || planned < today),
        )
        .sort((a, b) => a.planned.localeCompare(b.planned))
        .map(({ p, planned }) => ({ planned, ...hoseCells(p), type: p.type, status: p.status }))
      break

    case 'replacements':
      columns = [
        col('date', 'Дата', 'date', 11),
        col('old', 'Снято (EHS)', 'text', 11),
        col('new', 'Установлено (EHS)', 'text', 13),
        col('machine', 'Техника', 'text', 10),
        col('reason', 'Причина', 'text', 20),
        col('usage', 'Наработка', 'number', 10),
        col('unit', 'Ед.', 'text', 5),
        col('by', 'Кто выполнил', 'text', 14),
        col('comment', 'Комментарий', 'text', 28),
      ]
      rows = [...swaps]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((r) => ({
          date: r.date,
          old: r.oldSerialNumber,
          new: r.newSerialNumber,
          machine: r.garageNumber,
          reason: r.reason,
          usage: r.operatingHours,
          unit: r.operatingHours === null ? null : USAGE_UNIT_LABEL[r.usageUnit],
          by: r.performedBy,
          comment: r.comment,
        }))
      break

    case 'equipment': {
      const names = new Map(branchSummaries().map((b) => [b.id, b.name]))
      columns = [
        col('machine', 'Гаражный №', 'text', 10),
        col('model', 'Марка и модель', 'text', 22),
        col('type', 'Тип', 'text', 14),
        col('branch', 'Филиал', 'text', 16),
        col('hoses', 'РВД', 'number', 6),
        ...STATUS_COLUMNS,
        col('swaps', 'Замен за период', 'number', 10),
      ]
      rows = machines
        .map((m) => {
          const on = hoses.filter((p) => installed(p) && p.equipmentId === m.id)
          return {
            machine: m.garageNumber,
            model: `${m.brand} ${m.model}`,
            type: m.type,
            branch: names.get(m.branchId) ?? null,
            hoses: on.length,
            ...statusCounts(on),
            swaps: swaps.filter((r) => r.equipmentId === m.id).length,
          }
        })
        // Attention first: the machines with hoses to replace lead the page.
        .sort(
          (a, b) =>
            b.replace - a.replace || b.warn - a.warn || a.machine.localeCompare(b.machine, 'ru'),
        )
      totals = totalsOf(columns, rows)
      break
    }

    case 'branches':
      columns = [
        col('branch', 'Филиал', 'text', 18),
        col('machines', 'Техника', 'number', 8),
        col('hoses', 'РВД', 'number', 6),
        ...STATUS_COLUMNS,
        col('swaps', 'Замен за период', 'number', 10),
        col('requests', 'Заявок за период', 'number', 10),
      ]
      rows = branchSummaries()
        .filter((b) => !branch || b.id === branch)
        .map((b) => {
          const own = equipment.filter((e) => e.branchId === b.id)
          const ids = new Set(own.map((e) => e.id))
          const on = products.filter((p) => p.branchId === b.id && installed(p))
          return {
            branch: b.name,
            machines: own.length,
            hoses: on.length,
            ...statusCounts(on),
            swaps: swaps.filter((r) => ids.has(r.equipmentId)).length,
            requests: requests.filter((r) => r.branchId === b.id && inPeriod(r.createdAt)).length,
          }
        })
      totals = totalsOf(columns, rows)
      break

    default:
      return null
  }

  return {
    id,
    title: meta.title,
    branch: branch ? (branchSummaries().find((b) => b.id === branch)?.name ?? null) : null,
    period,
    generatedAt: new Date().toISOString(),
    columns,
    rows,
    totals,
  }
}
