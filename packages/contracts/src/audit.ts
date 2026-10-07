import { INSPECTION_LABEL } from './settings'
import { warnRuleLabel } from './status'
import type {
  Attachment,
  AuditChange,
  CabinetSettings,
  CabinetUser,
  RequestKind,
  ServiceRequest,
  UserRole,
} from './types'

/*
 * The action log's wording, shared by the mock and the API. Values are stored as
 * the customer reads them, so the log never needs the objects it describes (a
 * deleted user or a renamed branch still reads right).
 */

/** An object as the log shows it: field → value in words. */
export type AuditView = Record<string, string | null>

/** The server's own wording for roles; the UI's labels live in entities/user. */
export const ROLE_WORD: Record<UserRole, string> = {
  mechanic: 'Механик',
  engineer: 'Инженер',
  manager: 'Руководитель',
  admin: 'Администратор',
}

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  replace: 'Замена',
  manufacture: 'Изготовление',
  repair: 'Ремонт',
}

/** A user as the log shows them; `branchName` turns a branch id into its name. */
export const userView = (
  u: CabinetUser,
  branchName: (id: string) => string = (id) => id,
): AuditView => ({
  ФИО: u.name,
  Почта: u.email,
  Роль: ROLE_WORD[u.role],
  Филиалы: u.branchIds.length ? u.branchIds.map(branchName).join(', ') : 'Все филиалы',
  Доступ: u.active ? 'Активен' : 'Отключён',
})

export const settingsView = (s: CabinetSettings): AuditView => ({
  '«Внимание»': warnRuleLabel(s),
  'Предупреждать за, дней': s.leadDays.join(', ') || 'не предупреждать',
  'Письма на почту': s.channels.email ? 'Включены' : 'Выключены',
  'Осмотр рукавов': INSPECTION_LABEL[s.inspectionDays] ?? `раз в ${s.inspectionDays} дней`,
})

/** The fields that differ between two views; unchanged ones stay out of the log. */
export function auditChanges(before: AuditView, after: AuditView): AuditChange[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => (before[k] ?? null) !== (after[k] ?? null))
    .map((k) => ({ field: k, before: before[k] ?? null, after: after[k] ?? null }))
}

/** «Файлы: a.jpg, b.pdf» as one log line, or nothing when none were attached. */
export const filesChange = (files: Attachment[]): AuditChange[] =>
  files.length
    ? [{ field: 'Файлы', before: null, after: files.map((f) => f.fileName).join(', ') }]
    : []

/** A new request: its type, the hoses it names (`EHS …`), the quantity and the files. */
export const requestChanges = (r: ServiceRequest, hoses: string[]): AuditChange[] => [
  { field: 'Тип', before: null, after: REQUEST_KIND_LABEL[r.kind] },
  ...(hoses.length ? [{ field: 'Изделия', before: null, after: hoses.join(', ') }] : []),
  { field: 'Количество', before: null, after: String(r.quantity) },
  ...filesChange(r.attachments),
]
