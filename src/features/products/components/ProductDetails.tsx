import type { ReactNode } from 'react'
import type { Product } from '@/entities/types'
import { Card } from '@/shared/ui'
import { daysLeft, formatDate } from '@/shared/lib/utils'

export function ProductDetails({ product: p }: { product: Product }) {
  const left = daysLeft(p.installedAt, p.serviceLifeDays)
  const rows: [string, ReactNode][] = [
    ['EHS №', p.serialNumber],
    ['Внутренний №', p.clientNumber ?? '—'],
    ['OEM №', p.oemNumber ?? '—'],
    ['Тип', p.type],
    ['Характеристики', p.specs],
    ['Производитель', p.manufacturer],
    ['Дата изготовления', formatDate(p.manufacturedAt)],
    ['Дата отгрузки', formatDate(p.shippedAt)],
    ['Дата установки', formatDate(p.installedAt)],
    ['Гарантия', `${p.warrantyDays} дн.`],
    ['Срок эксплуатации', `${p.serviceLifeDays} дн.`],
    ['Остаток до замены', left === null ? '—' : `${left} дн.`],
    ['Место установки', p.installPlace ?? '—'],
  ]
  return (
    <Card title="Технические данные">
      <DescriptionList rows={rows} />
    </Card>
  )
}

function DescriptionList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
