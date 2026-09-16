import type { RequestStatus } from '@/entities/types'

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
}

export const REQUEST_STATUS_TONE = {
  new: 'brand',
  in_progress: 'warn',
  done: 'ok',
  rejected: 'none',
} as const satisfies Record<RequestStatus, string>

export const REQUEST_KIND_LABEL = { replace: 'Замена', manufacture: 'Изготовление' } as const
