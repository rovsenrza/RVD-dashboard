import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, SlidersHorizontal } from 'lucide-react'
import type { Product, ProductStatus } from '@/entities/types'
import { STATUS_LABEL } from '@/entities/product'
import { useProducts } from '@/shared/api/queries'
import {
  Button,
  Chip,
  DataTable,
  PageHeader,
  QueryState,
  SearchInput,
  Tabs,
  TableSkeleton,
} from '@/shared/ui'
import { productColumns } from './columns'

type Tab = 'active' | 'archive'

export function ProductsPage() {
  const query = useProducts()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState(params.get('q') ?? '')
  const [tab, setTab] = useState<Tab>('active')
  const navigate = useNavigate()
  const status = params.get('status') as ProductStatus | null

  const rows = useMemo(() => {
    const all = query.data ?? []
    return status ? all.filter((p) => p.status === status) : all
  }, [query.data, status])

  return (
    <div>
      <PageHeader
        title="Мои изделия"
        description="Реестр РВД, отгруженных вашей компании"
        actions={
          <>
            <Button variant="secondary" size="sm" icon={SlidersHorizontal}>
              Фильтры
            </Button>
            <Button variant="secondary" size="sm" icon={Download}>
              Экспорт
            </Button>
          </>
        }
      />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {() => (
          <DataTable
            data={tab === 'active' ? rows : []}
            columns={productColumns as ColumnDef<Product, unknown>[]}
            globalFilter={filter}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            pageSize={10}
            stickyFirstColumn
            tools
            hiddenByDefault={['clientNumber', 'manufacturer']}
            emptyTitle={tab === 'archive' ? 'В архиве пока ничего нет' : 'Изделий пока нет'}
            toolbar={
              <div className="flex flex-wrap items-center gap-4">
                <Tabs
                  items={[
                    { key: 'active', label: 'Активные', count: rows.length },
                    { key: 'archive', label: 'Архив' },
                  ]}
                  value={tab}
                  onChange={setTab}
                  className="border-b-0"
                />
                {status && (
                  <Chip
                    onRemove={() => {
                      params.delete('status')
                      setParams(params)
                    }}
                  >
                    Статус: {STATUS_LABEL[status]}
                  </Chip>
                )}
              </div>
            }
            search={
              <SearchInput
                id="products-search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="EHS, OEM, внутренний номер, техника…"
              />
            }
          />
        )}
      </QueryState>
    </div>
  )
}
