import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { SlidersHorizontal } from 'lucide-react'
import type { Product, ProductLifecycle, ProductStatus } from '@/entities/types'
import { LIFECYCLE_LABEL, STATUS_LABEL } from '@/entities/product'
import { useSession } from '@/app/session'
import { useCatalogNumbers, useEquipment, useProducts } from '@/shared/api/queries'
import {
  Button,
  Chip,
  DataTable,
  ExportMenu,
  PageHeader,
  type DataTableHandle,
  QueryState,
  SearchInput,
  Tabs,
  TableSkeleton,
} from '@/shared/ui'
import type { ExportColumn } from '@/shared/lib/export'
import { productColumns } from './columns'
import { ProductFilters } from './components/ProductFilters'
import { FILTER_KEYS, type FilterKey, type FilterValues } from './filters'

type Tab = 'active' | 'archive'

const EXPORT_COLUMNS: ExportColumn<Product>[] = [
  { header: 'EHS №', value: (p) => p.serialNumber, width: 10 },
  { header: 'Внутренний №', value: (p) => p.clientNumber, width: 12 },
  { header: 'OEM №', value: (p) => p.oemNumber, width: 12 },
  { header: 'Каталожный №', value: (p) => p.catalogNumber, width: 16 },
  { header: 'Тип', value: (p) => p.type, width: 12 },
  { header: 'Производитель', value: (p) => p.manufacturer, width: 14 },
  { header: 'Отгружено', value: (p) => p.shippedAt, type: 'date', width: 11 },
  { header: 'Установлено', value: (p) => p.installedAt, type: 'date', width: 11 },
  { header: 'Место установки', value: (p) => p.installPlace, width: 20 },
  { header: 'Срок эксплуатации, дн.', value: (p) => p.serviceLifeDays, width: 12 },
  { header: 'Состояние', value: (p) => STATUS_LABEL[p.status], width: 16 },
  { header: 'Статус в 1С', value: (p) => LIFECYCLE_LABEL[p.lifecycle], width: 16 },
]

export function ProductsPage() {
  const query = useProducts()
  const equipment = useEquipment()
  const catalog = useCatalogNumbers()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<Tab>('active')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const navigate = useNavigate()
  const { branch } = useSession()
  const table = useRef<DataTableHandle<Product>>(null)

  const active = useMemo(() => {
    const values: FilterValues = {}
    for (const key of FILTER_KEYS) {
      const value = params.get(key)
      if (value) values[key] = value
    }
    return values
  }, [params])

  const filtered = useMemo(() => {
    return (query.data ?? []).filter(
      (p) =>
        (!active.status || p.status === active.status) &&
        (!active.lifecycle || p.lifecycle === active.lifecycle) &&
        (!active.installed || (active.installed === '1') === (p.installedAt !== null)) &&
        (!active.equipment || p.equipmentId === active.equipment) &&
        (!active.catalog || p.catalogNumberId === active.catalog),
    )
  }, [query.data, active])

  const archived = useMemo(() => filtered.filter((p) => p.lifecycle === 'written_off'), [filtered])
  const rows = useMemo(() => filtered.filter((p) => p.lifecycle !== 'written_off'), [filtered])

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
            <ExportMenu
              fileName={tab === 'archive' ? 'изделия-архив' : 'изделия'}
              title={tab === 'archive' ? 'Мои изделия — архив' : 'Мои изделия'}
              lines={[
                branch?.name ?? 'Все филиалы',
                ...FILTER_KEYS.filter((key) => active[key]).map((key) =>
                  chipLabel(key, active[key]!),
                ),
                filter.trim() && `Поиск: «${filter.trim()}»`,
              ]}
              columns={EXPORT_COLUMNS}
              rows={() => table.current?.visibleRows() ?? (tab === 'archive' ? archived : rows)}
            />
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
            data={tab === 'active' ? rows : archived}
            columns={productColumns as ColumnDef<Product, unknown>[]}
            globalFilter={filter}
            handle={table}
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
                    { key: 'archive', label: 'Архив', count: archived.length },
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
