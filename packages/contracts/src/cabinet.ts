import type { AuditChange, Equipment, Product, SupportMessage, SupportTopic } from './types'

/*
 * What the customer alone knows and the cabinet keeps (not 1С): where a hose
 * sits and its own number, notes on a hose, messages to the supplier's
 * specialist. One set of rules for the form, the mock and the API.
 */

/** Longest note the cabinet keeps; the form counts down to it and the server refuses past it. */
export const COMMENT_MAX = 2000
/** Longest message to the specialist. */
export const SUPPORT_TEXT_MAX = 2000
/** Longest installation place or client number. */
export const LOCAL_FIELD_MAX = 120

/** Why this note cannot be saved, or null. */
export const commentProblem = (text: unknown) =>
  typeof text !== 'string' || !text.trim()
    ? 'Комментарий пустой'
    : text.length > COMMENT_MAX
      ? `Комментарий длиннее ${COMMENT_MAX} знаков — сократите его`
      : null

/** A note in the action log: long ones cut, so the log stays a log. */
const short = (text: string) => (text.length > 140 ? `${text.slice(0, 139)}…` : text)
export const commentChange = (before: string | null, after: string | null): AuditChange[] => [
  { field: 'Комментарий', before: before && short(before), after: after && short(after) },
]

/** What the customer may change on a hose: where it sits and the number they know it by. */
export type InstallationPatch = Partial<
  Pick<Product, 'equipmentId' | 'installPlace' | 'clientNumber'>
>

/** Why an installation change cannot be saved, or null. Dates are the supplier's (customer, 2026-10-03). */
export function installationProblem(patch: Record<string, unknown>): string | null {
  if ('installedAt' in patch)
    return 'Дату установки исправляет специалист — напишите ему из карточки изделия'
  for (const key of ['installPlace', 'clientNumber'] as const) {
    const v = patch[key]
    if (v !== undefined && v !== null && typeof v !== 'string') return 'Значение указано неверно'
    if (typeof v === 'string' && v.length > LOCAL_FIELD_MAX)
      return `Не длиннее ${LOCAL_FIELD_MAX} знаков`
  }
  return null
}

/** What the customer records about a machine that 1С does not keep: its department and factory number. */
export type EquipmentPatch = Partial<Pick<Equipment, 'department' | 'factoryNumber'>>

/** Why a machine change cannot be saved, or null. Garage number, make and owner are the supplier's. */
export function equipmentProblem(patch: Record<string, unknown>): string | null {
  for (const key of Object.keys(patch))
    if (key !== 'department' && key !== 'factoryNumber')
      return 'Гаражный номер, марку и владельца ведёт поставщик в 1С'
  for (const key of ['department', 'factoryNumber'] as const) {
    const v = patch[key]
    if (v !== undefined && v !== null && typeof v !== 'string') return 'Значение указано неверно'
    if (typeof v === 'string' && v.length > LOCAL_FIELD_MAX)
      return `Не длиннее ${LOCAL_FIELD_MAX} знаков`
  }
  return null
}

/** A machine as the action log shows it. */
export const equipmentView = (e: Pick<Equipment, 'department' | 'factoryNumber'>) => ({
  Подразделение: e.department,
  'Заводской №': e.factoryNumber,
})

/** «Связаться со специалистом» — what the message is about, in the order the form offers it. */
export const SUPPORT_TOPIC_LABEL: Record<SupportTopic, string> = {
  install_date: 'Исправить дату установки',
  product: 'Вопрос по изделию',
  request: 'Вопрос по заявке',
  other: 'Другое',
}

export type NewSupportMessage = Pick<SupportMessage, 'topic' | 'productId' | 'installedAt' | 'text'>

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

/**
 * Why a message cannot go to the specialist, or null. A date correction must
 * name the hose (already found in the asker's scope) and a date that can be
 * true: not ahead of today, not before the hose was shipped.
 */
export function supportProblem(
  body: Partial<NewSupportMessage>,
  product: Pick<Product, 'shippedAt'> | null,
  today: string,
): string | null {
  if (!body.topic || !Object.hasOwn(SUPPORT_TOPIC_LABEL, body.topic))
    return 'Неизвестная тема обращения'
  if (body.productId && !product) return 'Изделие не найдено'
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (text.length > SUPPORT_TEXT_MAX) return `Сообщение длиннее ${SUPPORT_TEXT_MAX} знаков`
  if (body.topic === 'install_date') {
    if (!product) return 'Укажите изделие, у которого неверная дата установки'
    const date = body.installedAt
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Укажите, какая дата установки верная'
    if (date > today) return 'Дата установки не может быть в будущем'
    if (product.shippedAt && date < product.shippedAt)
      return `Изделие отгружено ${dmy(product.shippedAt)}, раньше его не установить`
  } else if (!text) return 'Напишите, что нужно специалисту'
  return null
}

/** The message as the action log keeps it; `current` — the date the cabinet shows now. */
export const supportChanges = (m: SupportMessage, current: string | null): AuditChange[] => [
  { field: 'Тема', before: null, after: SUPPORT_TOPIC_LABEL[m.topic] },
  ...(m.installedAt
    ? [{ field: 'Дата установки', before: current && dmy(current), after: dmy(m.installedAt) }]
    : []),
  ...(m.text ? [{ field: 'Сообщение', before: null, after: m.text }] : []),
]
