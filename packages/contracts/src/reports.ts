import { differenceInCalendarDays, parseISO } from 'date-fns'
import { serviceDates, type StatusRules } from './status'
import type {
  Equipment,
  Product,
  ProductLifecycle,
  ProductStatus,
  Replacement,
  Report,
  ReportColumn,
  ReportId,
  ReportValue,
  ServiceRequest,
} from './types'

/*
 * The seven reports (Д21), built once for the mock and the API from the same
 * rows: every hose, machine, swap and request in scope, never a page of them.
 */

export interface ReportMeta {
  id: ReportId
  title: string
  description: string
  /** Which way the period runs from today; null — a report «на сегодня» without a period. */
  period: 'past' | 'future' | null
}

/** ТЗ §4, in the order a manager works through them: state now, what is coming, what happened. */
export const REPORTS: ReportMeta[] = [
  {
    id: 'registry',
    title: 'Реестр РВД',
    description: 'Все изделия филиала — на технике и на складе — с состоянием и сроками.',
    period: null,
  },
  {
    id: 'warranty',
    title: 'На гарантии',
    description:
      'Изделия в эксплуатации с действующей гарантией: до какого числа и сколько дней осталось.',
    period: null,
  },
  {
    id: 'due',
    title: 'Требуют замены',
    description: 'Изделия, выработавшие срок эксплуатации, — на сколько дней просрочена замена.',
    period: null,
  },
  {
    id: 'plan',
    title: 'План замен',
    description:
      'Что заменить до конца периода: срок эксплуатации истекает в периоде или уже истёк. Основа для заявки.',
    period: 'future',
  },
  {
    id: 'replacements',
    title: 'История замен',
    description: 'Замены за период: что сняли, что поставили, причина и наработка.',
    period: 'past',
  },
  {
    id: 'equipment',
    title: 'Статистика по технике',
    description: 'По каждой машине: сколько РВД, в каком они состоянии и сколько замен за период.',
    period: 'past',
  },
  {
    id: 'branches',
    title: 'Статистика по филиалам',
    description: 'По филиалам: техника, РВД, состояние, замены и заявки за период.',
    period: 'past',
  },
]

export const reportMeta = (id: string | null) => REPORTS.find((r) => r.id === id) ?? null

export const LIFECYCLE_LABEL: Record<ProductLifecycle, string> = {
  manufacturing: 'Изготавливается',
  in_stock: 'На складе',
  shipped: 'Отгружен',
  in_operation: 'В эксплуатации',
  needs_replacement: 'Требует замены',
  written_off: 'Списан',
}

export const USAGE_UNIT_LABEL: Record<Replacement['usageUnit'], string> = { hours: 'м/ч', km: 'км' }

/** Everything a report may read, already in the asker's scope; hose statuses by the company's rule. */
export interface ReportData {
  products: Product[]
  equipment: Equipment[]
  replacements: Replacement[]
  requests: Pick<ServiceRequest, 'branchId' | 'createdAt'>[]
  branches: { id: string; name: string }[]
}

export interface ReportParams {
  /** Narrow to one branch; null — the whole company */
  branch: string | null
  from: string | null
  to: string | null
  rules: StatusRules
  /** ISO date the report is «на» */
  today: string
  /** ISO date-time stamped on it */
  generatedAt: string
}

type Row = Record<string, ReportValue>

const col = (
  key: string,
  header: string,
  type: ReportColumn['type'] = 'text',
  width?: number,
): ReportColumn => ({ key, header, type, width })

const STATUS_KEYS: ProductStatus[] = ['ok', 'warn', 'replace', 'no_warranty']
const STATUS_COLUMNS = [
  col('ok', 'Норма', 'number', 8),
  col('warn', 'Внимание', 'number', 9),
  col('replace', 'Замена', 'number', 8),
  col('no_warranty', 'Без гарантии', 'number', 10),
]
const HOSE_COLUMNS = [
  col('serial', 'EHS №', 'text', 10),
  col('catalog', 'Каталожный № (OEM)', 'text', 18),
  col('machine', 'Техника', 'text', 10),
  col('place', 'Место установки', 'text', 20),
]
/** The cabinet's one start date: installation as 1С has it, else shipment (customer, 2026-10-03). */
const START = col('installed', 'Установлено', 'date', 11)

const days = (from: string, to: string) => differenceInCalendarDays(parseISO(to), parseISO(from))

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

/**
 * One report, every row in scope, sorted the way it is read, with totals where
 * they add up. A hose is in service from its start date (installation, else
 * shipment) until 1С writes it off — the same clock as statuses and the dashboard.
 */
export function buildReport(id: ReportId, data: ReportData, params: ReportParams): Report | null {
  const meta = reportMeta(id)
  if (!meta) return null
  const { branch, rules, today } = params
  const period =
    meta.period && params.from && params.to ? { from: params.from, to: params.to } : null
  const inBranch = <T extends { branchId: string }>(rows: T[]) =>
    branch ? rows.filter((r) => r.branchId === branch) : rows
  const hoses = inBranch(data.products)
  const machines = inBranch(data.equipment)
  const garage = new Map(data.equipment.map((m) => [m.id, m.garageNumber]))
  const machineIds = new Set<string | null>(machines.map((m) => m.id))
  const inPeriod = (date: string) => !period || (date >= period.from && date <= period.to)
  const swaps = data.replacements.filter((r) => machineIds.has(r.equipmentId) && inPeriod(r.date))

  const notRetired = (p: Product) => p.lifecycle !== 'written_off'
  const dates = (p: Product) => serviceDates(p, rules)
  const inService = (p: Product) => notRetired(p) && dates(p) !== null
  const start = (p: Product) => p.installedAt ?? p.shippedAt
  const hoseCells = (p: Product) => ({
    serial: p.serialNumber,
    catalog: p.catalogNumber,
    machine: p.equipmentId ? (garage.get(p.equipmentId) ?? null) : null,
    place: p.installPlace,
  })
  // A hose with no service life on record (0 in 1С) has no planned date to measure against.
  const planned = (p: Product) => (p.serviceLifeDays > 0 ? (dates(p)?.plannedAt ?? null) : null)

  let columns: ReportColumn[]
  let rows: Row[]
  let totals: Row | null = null

  switch (id) {
    case 'registry':
      columns = [
        ...HOSE_COLUMNS,
        START,
        col('status', 'Состояние', 'status', 16),
        col('left', 'До плановой замены, дн.', 'number', 12),
        col('lifecycle', 'Статус в 1С', 'text', 16),
      ]
      rows = hoses
        .filter(notRetired)
        // By machine, so a printed page reads machine by machine; stock last.
        .map((p) => {
          const due = planned(p)
          return {
            ...hoseCells(p),
            installed: start(p),
            status: start(p) ? p.status : null,
            left: due ? days(today, due) : null,
            lifecycle: LIFECYCLE_LABEL[p.lifecycle],
          }
        })
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
        START,
        col('until', 'Гарантия до', 'date', 11),
        col('left', 'Осталось, дн.', 'number', 10),
      ]
      rows = hoses
        .filter((p) => inService(p) && p.warrantyDays > 0)
        .map((p) => ({ p, until: dates(p)!.warrantyUntil }))
        .filter(({ until }) => until >= today)
        .sort((a, b) => a.until.localeCompare(b.until))
        .map(({ p, until }) => ({
          ...hoseCells(p),
          installed: start(p),
          until,
          left: days(today, until),
        }))
      break

    case 'due':
      columns = [
        ...HOSE_COLUMNS,
        START,
        col('planned', 'Плановая замена', 'date', 12),
        col('overdue', 'Просрочено, дн.', 'number', 10),
      ]
      rows = hoses
        .filter((p) => inService(p) && p.status === 'replace' && planned(p) !== null)
        .map((p) => ({
          ...hoseCells(p),
          installed: start(p),
          planned: planned(p),
          overdue: days(planned(p)!, today),
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
        .filter((p) => inService(p) && planned(p) !== null)
        .map((p) => ({ p, due: planned(p)! }))
        // Due inside the period, or already overdue: both have to be ordered now.
        .filter(({ due }) => (!period || due <= period.to) && (inPeriod(due) || due < today))
        .sort((a, b) => a.due.localeCompare(b.due))
        .map(({ p, due }) => ({ planned: due, ...hoseCells(p), type: p.type, status: p.status }))
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
      const names = new Map(data.branches.map((b) => [b.id, b.name]))
      columns = [
        col('machine', 'Гаражный №', 'text', 10),
        col('model', 'Марка и модель', 'text', 22),
        col('type', 'Тип', 'text', 14),
        col('branch', 'Филиал', 'text', 16),
        col('hoses', 'РВД', 'number', 6),
        ...STATUS_COLUMNS,
        col('swaps', 'Замен за период', 'number', 10),
      ]
      const onMachine = new Map<string, Product[]>()
      for (const p of hoses)
        if (p.equipmentId && inService(p))
          onMachine.set(p.equipmentId, [...(onMachine.get(p.equipmentId) ?? []), p])
      rows = machines
        .map((m) => {
          const on = onMachine.get(m.id) ?? []
          return {
            machine: m.garageNumber,
            model: [m.brand, m.model].filter(Boolean).join(' ') || null,
            type: m.type || null,
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
      rows = data.branches
        .filter((b) => !branch || b.id === branch)
        .map((b) => {
          const own = data.equipment.filter((e) => e.branchId === b.id)
          const ids = new Set<string | null>(own.map((e) => e.id))
          const on = data.products.filter((p) => p.branchId === b.id && inService(p))
          return {
            branch: b.name,
            machines: own.length,
            hoses: on.length,
            ...statusCounts(on),
            swaps: swaps.filter((r) => ids.has(r.equipmentId)).length,
            requests: data.requests.filter(
              (r) => r.branchId === b.id && inPeriod(r.createdAt.slice(0, 10)),
            ).length,
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
    branch: branch ? (data.branches.find((b) => b.id === branch)?.name ?? null) : null,
    period,
    generatedAt: params.generatedAt,
    columns,
    rows,
    totals,
  }
}
