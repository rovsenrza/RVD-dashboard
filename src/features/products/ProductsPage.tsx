import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import type { Product } from '@/entities/types'
import { useProducts } from '@/shared/api/queries'
import { DataTable, PageHeader, QueryState, SearchInput, TableSkeleton } from '@/shared/ui'
import { productColumns } from './columns'

export function ProductsPage() {
  const query = useProducts()
  const [filter, setFilter] = useState('')
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Мои изделия"
        actions={
          <SearchInput
            id="products-search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск по EHS, OEM, технике…"
            className="w-72 max-w-full"
          />
        }
      />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(data) => (
          <DataTable
            data={data}
            columns={productColumns as ColumnDef<Product, unknown>[]}
            globalFilter={filter}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            emptyTitle="Изделий пока нет"
          />
        )}
      </QueryState>
    </div>
  )
}
