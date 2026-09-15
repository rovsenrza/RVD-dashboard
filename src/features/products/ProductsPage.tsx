import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import type { Product } from '@/entities/types'
import { useProducts } from '@/shared/api/queries'
import { DataTable } from '@/shared/ui/DataTable'
import { productColumns } from './columns'

export function ProductsPage() {
  const { data = [], isPending } = useProducts()
  const [filter, setFilter] = useState('')
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Мои изделия</h1>
        <label className="relative">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск по EHS, OEM, технике…"
            className="w-72 max-w-full rounded-md border border-line bg-surface py-1.5 pr-3 pl-8 text-sm outline-none focus:border-brand"
          />
        </label>
      </div>
      {isPending ? (
        <p className="text-ink-muted">Загрузка…</p>
      ) : (
        <DataTable
          data={data}
          columns={productColumns as ColumnDef<Product, unknown>[]}
          globalFilter={filter}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
        />
      )}
    </div>
  )
}
