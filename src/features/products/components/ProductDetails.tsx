import type { ReactNode } from 'react'
import type { Product } from '@/entities/types'
import { LIFECYCLE_LABEL } from '@/entities/product'
import { Badge, Card, DescriptionList } from '@/shared/ui'
import { daysLeft, formatDate } from '@/shared/lib/utils'

export function ProductDetails({ product: p }: { product: Product }) {
  const left = daysLeft(p.installedAt, p.serviceLifeDays)
  const groups: { title: string; rows: [string, ReactNode][] }[] = [
    {
      title: 'Идентификация',
      rows: [
        ['EHS №', p.serialNumber],
        ['Внутренний №', p.clientNumber],
        ['OEM №', p.oemNumber],
        ['Каталожный №', p.catalogNumber],
        ['Номенклатурный №', p.nomenclatureNumber],
      ],
    },
    {
      title: 'Характеристики',
      rows: [
        ['Тип', p.type],
        ['Диаметр', `${p.diameter} мм`],
        ['Оплётки / навивки', p.braidCount],
        ['Параметры', p.specs],
        ['Производитель', p.manufacturer],
      ],
    },
    {
      title: 'Сроки',
      rows: [
        ['Изготовлено', formatDate(p.manufacturedAt)],
        ['Отгружено', formatDate(p.shippedAt)],
        ['Установлено', formatDate(p.installedAt)],
        ['Гарантия', `${p.warrantyDays} дн.`],
        ['Срок эксплуатации', `${p.serviceLifeDays} дн.`],
        [
          'До плановой замены',
          left === null ? null : (
            <Badge tone={left < 0 ? 'replace' : left <= 30 ? 'warn' : 'ok'}>
              {left < 0 ? `просрочено на ${-left} дн.` : `${left} дн.`}
            </Badge>
          ),
        ],
      ],
    },
    {
      title: 'Установка',
      rows: [
        ['Место установки', p.installPlace],
        ['Статус в 1С', LIFECYCLE_LABEL[p.lifecycle]],
      ],
    },
  ]
  return (
    <Card title="Технические данные">
      <div className="divide-y divide-line">
        {groups.map((g) => (
          <div key={g.title} className="py-3 first:pt-0 last:pb-0">
            <div className="mb-1.5 text-caption font-medium tracking-wide text-ink-muted uppercase">
              {g.title}
            </div>
            <DescriptionList items={g.rows} />
          </div>
        ))}
      </div>
    </Card>
  )
}
