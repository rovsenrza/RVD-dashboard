import { Link } from 'react-router-dom'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { DashboardSummary } from '@/entities/types'
import { Badge, Card, DataTable, valueOr } from '@/shared/ui'
import { formatDate } from '@/shared/lib/utils'

type Row = DashboardSummary['upcoming'][number]
const col = createColumnHelper<Row>()
const columns = [
  col.accessor('serialNumber', {
    header: 'EHS №',
    cell: (c) => (
      <Link
        to={`/products/${c.row.original.productId}`}
        className="font-medium text-brand-deep hover:underline"
      >
        {c.getValue()}
      </Link>
    ),
  }),
  col.accessor('equipment', { header: 'Техника' }),
  col.accessor('dueDate', {
    header: 'Плановая дата',
    cell: (c) => valueOr(formatDate(c.getValue())),
  }),
  col.accessor((r) => differenceInCalendarDays(parseISO(r.dueDate), new Date()), {
    id: 'left',
    header: 'Осталось',
    cell: (c) => {
      const d = c.getValue()
      return <Badge tone={d <= 7 ? 'replace' : d <= 30 ? 'warn' : 'neutral'}>{d} дн.</Badge>
    },
  }),
]

export function UpcomingTable({ rows }: { rows: Row[] }) {
  return (
    <Card
      title="Ближайшие плановые замены"
      action={
        <Link to="/products?sort=due" className="text-[13px] text-brand-deep hover:underline">
          Все изделия
        </Link>
      }
    >
      <DataTable data={rows} columns={columns as ColumnDef<Row, unknown>[]} pageSize={8} embedded />
    </Card>
  )
}
