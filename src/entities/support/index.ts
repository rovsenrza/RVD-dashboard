import type { SupportTopic } from '@/entities/types'

/** «Связаться со специалистом» — what the message is about, in the order the form offers it. */
export const SUPPORT_TOPIC_LABEL: Record<SupportTopic, string> = {
  install_date: 'Исправить дату установки',
  product: 'Вопрос по изделию',
  request: 'Вопрос по заявке',
  other: 'Другое',
}
