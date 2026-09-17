import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, SlidersHorizontal } from 'lucide-react'
import type { Product, ProductLifecycle, ProductStatus } from '@/entities/types'
import { LIFECYCLE_LABEL, STATUS_LABEL } from '@/entities/product'
import { useCatalogNumbers, useEquipment, useProducts } from '@/shared/api/queries'
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
import { ProductFilters } from './components/ProductFilters'
import { FILTER_KEYS, type FilterKey, type FilterValues } from './filters'

type Tab = 'active' | 'archive'

export function ProductsPage() {
  const query = useProducts()
  const equipment = useEquipment()
  const catalog = useCatalogNumbers()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<Tab>('active')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const navigate = useNavigate()

  const active = useMemo(() => {
    const values: FilterValues = {}
    for (const key of FILTER_KEYS) {
      const value = params.get(key)
      if (value) values[key] = value
    }
    return values
  }, [params])

  const rows = useMemo(() => {
    return (query.data ?? []).filter(
      (p) =>
        (!active.status || p.status === active.status) &&
        (!active.lifecycle || p.lifecycle === active.lifecycle) &&
        (!active.installed || (active.installed === '1') === (p.installedAt !== null)) &&
        (!active.equipment || p.equipmentId === active.equipment) &&
        (!active.catalog || p.catalogNumberId === active.catalog),
    )
  }, [query.data, active])

  const chipLabel = (key: FilterKey, value: string) => {
    if (key === 'status') return `Состояние: ${STATUS_LABEL[value as ProductStatus]}`
    if (key === 'lifecycle') return `В 1С: ${LIFECYCLE_LABEL[value as ProductLifecycle]}`
    if (key === 'installed') return value === '1' ? 'На технике' : 'Не установлены'
    if (key === 'equipment') {
      const e = equipment.data?.find((x) => x.id === value)
      return `Техника: ${e ? e.garageNumber : value}`
    }
    const c = catalog.data?.find((x) => x.id === value)
    return `Каталог: ${c ? c.name : value}`
  }

  const removeFilter = (key: FilterKey) => {
    params.delete(key)
    setParams(params)
  }

  return (
    <div>
      <PageHeader
        title="Мои изделия"
        description="Реестр РВД, отгруженных вашей компании"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={SlidersHorizontal}
              onClick={() => setFiltersOpen(true)}
            >
              Фильтры
              {Object.keys(active).length > 0 && ` · ${Object.keys(active).length}`}
            </Button>
            <Button variant="secondary" size="sm" icon={Download}>
              Экспорт
            </Button>
          </>
        }
      />
      <ProductFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        values={active}
        onApply={setParams}
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
                {FILTER_KEYS.filter((key) => active[key]).map((key) => (
                  <Chip key={key} onRemove={() => removeFilter(key)}>
                    {chipLabel(key, active[key]!)}
                  </Chip>
                ))}
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
