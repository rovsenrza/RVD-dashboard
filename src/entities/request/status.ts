import type { RequestKind, RequestStatus } from '@/entities/types'

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

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  replace: 'Замена',
  manufacture: 'Изготовление',
  repair: 'Ремонт',
}

/** What each type asks of the form (customer, 2026-10-03). */
export const REQUEST_KIND_HINT: Record<RequestKind, string> = {
  replace: 'Взамен ваших изделий — выберите их из реестра, в том числе из архива.',
  manufacture:
    'Новые рукава по каталожным номерам: впишите, выберите из подсказки, вставьте списком — или просто приложите таблицу Excel.',
  repair: 'Что отремонтировать: номера вписываются свободно — или приложите таблицу Excel.',
}
