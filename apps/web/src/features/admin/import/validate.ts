import { format } from 'date-fns'
import type { Branch, CabinetUser, UserRole } from '@/entities/types'
import { ROLE_LABEL, ROLE_ORDER, isBranchBound } from '@/entities/user'
import type { UserDraft } from '@/shared/api/queries'
import type { Cell } from './excel'

export interface ImportColumn {
  key: string
  header: string
  /** Older names of the header that templates already filled in may carry */
  aliases?: string[]
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
  const at = (c: ImportColumn) =>
    [c.header, ...(c.aliases ?? [])].map((h) => index.get(norm(h))).find((i) => i !== undefined)
  const missing = columns.filter((c) => c.required && at(c) === undefined)
  if (missing.length)
    return {
      error: `Нет колонок: ${missing.map((c) => `«${c.header}»`).join(', ')}. Возьмите шаблон.`,
    }
  const rows: CheckedRow<T>[] = []
  body.forEach((raw, i) => {
    if (raw.every((c) => text(c) === '')) return
    const get = (key: string) => {
      const i = at(columns.find((c) => c.key === key)!)
      return i === undefined ? null : (raw[i] ?? null)
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
