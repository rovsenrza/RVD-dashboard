import { format, isValid, parse } from 'date-fns'
import type { Branch, CabinetUser, Equipment, Product, UserRole } from '@/entities/types'
import { INSTALL_PLACES } from '@/entities/product'
import { ROLE_LABEL, ROLE_ORDER, isBranchBound } from '@/entities/user'
import type { InstallationPatch, UserDraft } from '@/shared/api/queries'
import type { Cell } from './excel'

export interface ImportColumn {
  key: string
  header: string
  required?: boolean
}

/** One sheet row after checking: the line number the user sees in Excel, its cells, and why it cannot go in. */
export interface CheckedRow<T> {
  line: number
  cells: Record<string, string>
  value: T | null
  errors: string[]
}

export type ImportCheck<T> = { error: string } | { rows: CheckedRow<T>[] }

const norm = (s: string) => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

const text = (c: Cell | undefined): string =>
  c === null || c === undefined
    ? ''
    : c instanceof Date
      ? format(c, 'dd.MM.yyyy')
      : String(c).trim()

/**
 * Finds the columns by their header text (order, a trailing «*» and case do
 * not matter), then hands every non-empty row to `check`.
 */
function checkSheet<T>(
  sheet: Cell[][],
  columns: ImportColumn[],
  check: (get: (key: string) => Cell, errors: string[], line: number) => T | null,
): ImportCheck<T> {
  const [head, ...body] = sheet
  if (!head) return { error: 'Файл пустой' }
  const index = new Map(head.map((h, i) => [norm(text(h)), i]))
  const missing = columns.filter((c) => c.required && !index.has(norm(c.header)))
  if (missing.length)
    return {
      error: `Нет колонок: ${missing.map((c) => `«${c.header}»`).join(', ')}. Возьмите шаблон.`,
    }
  const rows: CheckedRow<T>[] = []
  body.forEach((raw, i) => {
    if (raw.every((c) => text(c) === '')) return
    const get = (key: string) => {
      const col = columns.find((c) => c.key === key)!
      const at = index.get(norm(col.header))
      return at === undefined ? null : (raw[at] ?? null)
    }
    const errors: string[] = []
    for (const c of columns)
      if (c.required && text(get(c.key)) === '') errors.push(`не заполнено «${c.header}»`)
    const value = errors.length ? null : check(get, errors, i + 2)
    rows.push({
      line: i + 2,
      cells: Object.fromEntries(columns.map((c) => [c.key, text(get(c.key))])),
      value: errors.length ? null : value,
      errors,
    })
  })
  if (!rows.length) return { error: 'В файле нет строк с данными' }
  return { rows }
}

// ── Users ────────────────────────────────────────────────────────────────────

export const USER_COLUMNS: ImportColumn[] = [
  { key: 'name', header: 'ФИО', required: true },
  { key: 'email', header: 'Почта', required: true },
  { key: 'role', header: 'Роль', required: true },
  { key: 'branches', header: 'Филиалы' },
]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function checkUsers(
  sheet: Cell[][],
  existing: CabinetUser[],
  branches: Branch[],
): ImportCheck<UserDraft> {
  const taken = new Map(existing.map((u) => [u.email.toLowerCase(), 'уже есть в кабинете']))
  return checkSheet(sheet, USER_COLUMNS, (get, errors, line) => {
    const email = text(get('email')).toLowerCase()
    if (!EMAIL.test(email)) errors.push('почта указана с ошибкой')
    else if (taken.has(email)) errors.push(`почта ${taken.get(email)}`)
    else taken.set(email, `повторяется: строка ${line}`)

    const roleText = norm(text(get('role')))
    const role = ROLE_ORDER.find((r) => norm(ROLE_LABEL[r]) === roleText) as UserRole | undefined
    if (!role) errors.push(`роль — одна из: ${ROLE_ORDER.map((r) => ROLE_LABEL[r]).join(', ')}`)

    const names = text(get('branches'))
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => s && norm(s) !== 'все' && norm(s) !== 'все филиалы')
    const branchIds: string[] = []
    for (const n of names) {
      const b = branches.find((x) => norm(x.name) === norm(n))
      if (b) branchIds.push(b.id)
      else errors.push(`филиал «${n}» не найден`)
    }
    if (role && isBranchBound(role) && branchIds.length !== 1)
      errors.push('механику нужен ровно один филиал')

    if (errors.length || !role) return null
    return { name: text(get('name')), email, role, branchIds }
  })
}

// ── Installation facts ───────────────────────────────────────────────────────

export const INSTALL_COLUMNS: ImportColumn[] = [
  { key: 'ehs', header: 'EHS №', required: true },
  { key: 'garage', header: 'Гаражный №', required: true },
  { key: 'place', header: 'Место установки', required: true },
  { key: 'date', header: 'Дата установки', required: true },
  { key: 'client', header: 'Внутренний №' },
]

export interface InstallationRow {
  productId: string
  label: string
  patch: InstallationPatch
}

/** A date cell, or text as дд.мм.гггг; returned as ISO. */
function dateOf(c: Cell): string | null {
  if (c instanceof Date) return isValid(c) ? format(c, 'yyyy-MM-dd') : null
  const d = parse(text(c), 'dd.MM.yyyy', new Date())
  return isValid(d) && format(d, 'dd.MM.yyyy') === text(c) ? format(d, 'yyyy-MM-dd') : null
}

export function checkInstallations(
  sheet: Cell[][],
  products: Product[],
  equipment: Equipment[],
  today = new Date(),
): ImportCheck<InstallationRow> {
  const seen = new Map<string, number>()
  const todayIso = format(today, 'yyyy-MM-dd')
  return checkSheet(sheet, INSTALL_COLUMNS, (get, errors, line) => {
    const ehs = text(get('ehs')).replace(/^(ehs|esm)[\s:№#-]*/i, '')
    const product = products.find((p) => p.serialNumber === ehs)
    if (!product) errors.push(`изделие EHS ${ehs} не найдено`)
    else if (seen.has(ehs)) errors.push(`изделие повторяется: строка ${seen.get(ehs)}`)
    else seen.set(ehs, line)

    const garage = text(get('garage'))
    const machine = equipment.find((e) => norm(e.garageNumber) === norm(garage))
    if (!machine) errors.push(`техника ${garage} не найдена`)

    const place = INSTALL_PLACES.find((p) => norm(p) === norm(text(get('place'))))
    if (!place) errors.push(`место — одно из: ${INSTALL_PLACES.join('; ')}`)

    const installedAt = dateOf(get('date'))
    if (!installedAt) errors.push('дата — в формате дд.мм.гггг')
    else if (installedAt > todayIso) errors.push('дата установки в будущем')

    if (errors.length || !product || !machine || !place || !installedAt) return null
    const client = text(get('client'))
    return {
      productId: product.id,
      label: `EHS ${product.serialNumber}`,
      patch: {
        equipmentId: machine.id,
        installPlace: place,
        installedAt,
        ...(client ? { clientNumber: client } : {}),
      },
    }
  })
}
