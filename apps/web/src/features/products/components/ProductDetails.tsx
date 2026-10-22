import type { ReactNode } from 'react'
import type { Equipment, Product } from '@/entities/types'
import { LIFECYCLE_LABEL, STATUS_TONE, daysLeft } from '@/entities/product'
import { Badge, Button, Card, DescriptionList } from '@/shared/ui'
import { formatDate } from '@/shared/lib/utils'
import { machineName } from '../columns'

/**
 * `machine`: the one the hose is on, when it is. `onAskDate`: the installation date is the supplier's (1С) — the customer
 * cannot edit it, only ask the specialist to correct it.
 */
export function ProductDetails({
  product: p,
  machine,
  onAskDate,
}: {
  product: Product
  machine?: Equipment
  onAskDate?: () => void
}) {
  const left = daysLeft(p)
  const groups: { title: string; rows: [string, ReactNode][] }[] = [
    {
      title: 'Идентификация',
      rows: [
        ['Серийный №', p.serialNumber],
        ['Ваш внутренний №', p.clientNumber],
        ['Каталожный № (OEM)', p.catalogNumber],
        ['Номенклатурный №', p.nomenclatureNumber],
        // Diameter, braids, parameters and maker are the supplier's, not the client's
        // (customer, 2026-10-24).
        ['Наименование', p.type],
      ],
    },
    {
      title: 'Сроки',
      rows: [
        ['Изготовлено', formatDate(p.manufacturedAt)],
        ['Отгружено', formatDate(p.shippedAt)],
        [
          'Установлено',
          p.installedAt || p.shippedAt ? (
            <span key="installed" className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {p.installedAt ? (
                formatDate(p.installedAt)
              ) : (
                <span className="text-ink-muted">{formatDate(p.shippedAt)} · по дате отгрузки</span>
              )}
              {onAskDate && (
                <Button variant="link" size="inline" onClick={onAskDate}>
                  Попросить исправить
                </Button>
              )}
            </span>
          ) : null,
        ],
        ['Гарантия', `${p.warrantyDays} дн.`],
        ['Срок эксплуатации', `${p.serviceLifeDays} дн.`],
        [
          'До плановой замены',
          left === null ? null : (
            <Badge tone={STATUS_TONE[p.status]}>
              {left < 0 ? `просрочено на ${-left} дн.` : `${left} дн.`}
            </Badge>
          ),
        ],
      ],
    },
    {
      title: 'Установка',
      rows: [
        // No one fills «Место установки» in 1С: the machine instead (customer, 2026-10-22).
        ['Тип', machine?.type],
        ['Марка / Модель', machineName(machine)],
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
