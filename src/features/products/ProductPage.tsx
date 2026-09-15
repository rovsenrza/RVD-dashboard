import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useProduct } from '@/shared/api/queries'
import { Card } from '@/shared/ui/Card'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { daysLeft, formatDate } from '@/shared/lib/utils'

export function ProductPage() {
  const { id = '' } = useParams()
  const { data: p, isPending, error } = useProduct(id)
  if (isPending) return <p className="text-ink-muted">Загрузка…</p>
  if (error || !p) return <p className="text-status-replace">Изделие не найдено</p>

  const left = daysLeft(p.installedAt, p.serviceLifeDays)
  const rows: [string, React.ReactNode][] = [
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
    <div className="space-y-4">
      <Link
        to="/products"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={14} /> К списку
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-xl font-semibold">
          Изделие {p.serialNumber} <StatusBadge status={p.status} />
        </h1>
        <button className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-ink hover:bg-brand-dark">
          Создать заявку на замену
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Технические данные">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="История замен и ремонтов">
          <p className="text-sm text-ink-muted">Будет заполнено из журнала замен (ТЗ 3.5).</p>
        </Card>
      </div>
    </div>
  )
}
