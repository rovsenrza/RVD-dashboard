import type { UserRole } from '@/entities/types'

export const ROLE_ORDER: UserRole[] = ['mechanic', 'engineer', 'manager', 'admin']

export const ROLE_LABEL: Record<UserRole, string> = {
  mechanic: 'Механик',
  engineer: 'Инженер',
  manager: 'Руководитель',
  admin: 'Администратор',
}

/** What the role may do, in the customer's words (ТЗ, PLAN.md §1). */
export const ROLE_SCOPE: Record<UserRole, string> = {
  mechanic: 'Свой филиал: просмотр, факт замены, заявки',
  engineer: 'Все филиалы компании',
  manager: 'Все филиалы, отчёты и сравнение техники',
  admin: 'Пользователи и настройки кабинета',
}

/** Roles bound to a single branch; the branch switcher is locked for them. */
export const isBranchBound = (role: UserRole) => role === 'mechanic'
