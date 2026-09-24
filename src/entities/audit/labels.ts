import type { AuditAction, AuditTargetKind } from '@/entities/types'

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  'installation.update': 'Изменён факт установки',
  'request.create': 'Создана заявка',
  'user.create': 'Добавлен пользователь',
  'user.update': 'Изменён пользователь',
  'user.deactivate': 'Отключён доступ',
  'user.activate': 'Возвращён доступ',
  'user.password': 'Сброшен пароль',
  'settings.update': 'Изменены настройки',
  'replacement.create': 'Зафиксирована замена',
  'attachment.create': 'Добавлен файл',
  'attachment.delete': 'Удалён файл',
  'comment.create': 'Добавлен комментарий',
  'comment.update': 'Изменён комментарий',
  'comment.delete': 'Удалён комментарий',
}

export const AUDIT_TARGET_LABEL: Record<AuditTargetKind, string> = {
  product: 'Изделия',
  request: 'Заявки',
  user: 'Пользователи',
  settings: 'Настройки',
}
