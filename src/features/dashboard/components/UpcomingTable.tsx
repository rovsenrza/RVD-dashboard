import { Link } from 'react-router-dom'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import type { DashboardSummary } from '@/entities/types'
import { Card, DataTable } from '@/shared/ui'
import { formatDate } from '@/shared/lib/utils'

type Row = DashboardSummary['upcoming'][number]
const col = createColumnHelper<Row>()
const columns = [
  col.accessor('serialNumber', {
    header: 'EHS №',
    cell: (c) => (
      <Link
        to={`/products/${c.row.original.productId}`}
        className="font-medium text-brand-dark hover:underline"
      >
        {c.getValue()}
      </Link>
    ),
  }),
  col.accessor('equipment', { header: 'Техника' }),
  col.accessor('dueDate', { header: 'Плановая дата', cell: (c) => formatDate(c.getValue()) }),
]

export function UpcomingTable({ rows }: { rows: Row[] }) {
  return (
    <Card
      title="Ближайшие плановые замены"
      action={
        <Link to="/products" className="text-xs text-brand-dark hover:underline">
          Все изделия
        </Link>
      }
    >
      <DataTable data={rows} columns={columns as ColumnDef<Row, unknown>[]} pageSize={8} compact />
    </Card>
  )
}
