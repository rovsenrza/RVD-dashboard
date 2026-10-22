import { useMemo, useState } from 'react'
import {
  useNavigate,
  useSearchParams,
  createSearchParams,
  type URLSearchParamsInit,
} from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'
import type {
  Equipment,
  Product,
  ProductLifecycle,
  ProductSortKey,
  ProductStatus,
} from '@/entities/types'
import { LIFECYCLE_LABEL, STATUS_LABEL, serviceDates } from '@/entities/product'
import { PRODUCT_SORT_KEYS } from '@/entities/product/list'
import { MAX_REQUEST_POSITIONS } from '@/entities/request/rules'
import { useSession } from '@/app/session'
import {
  useCatalogNumbers,
  useEquipment,
  useProductPage,
  useProductRows,
  type ProductPageQuery,
} from '@/shared/api/queries'
import { useDebounced } from '@/shared/lib/useDebounced'
import {
  Button,
  Chip,
  DataTable,
  ExportMenu,
  PageHeader,
  QueryState,
  SearchInput,
  SelectionBar,
  Tabs,
  TableSkeleton,
} from '@/shared/ui'
import type { ExportColumn } from '@/shared/lib/export'
import { RequestForm } from '@/features/requests/components/RequestForm'
import { LIST_KEYS, useListParams } from '@/shared/lib/listParams'
import { machineName, productColumns } from './columns'
import { ProductFilters } from './components/ProductFilters'
import { FILTER_KEYS, type FilterKey, type FilterValues } from './filters'

type Tab = 'active' | 'archive'

const exportColumns = (machines: ReadonlyMap<string, Equipment>): ExportColumn<Product>[] => [
  { header: 'Серийный №', value: (p) => p.serialNumber, width: 14 },
  { header: 'Ваш внутренний №', value: (p) => p.clientNumber, width: 14 },
  { header: 'Каталожный № (OEM)', value: (p) => p.catalogNumber, width: 18 },
  { header: 'Наименование', value: (p) => p.type, width: 12 },
  { header: 'Отгружено', value: (p) => p.shippedAt, type: 'date', width: 11 },
  { header: 'Установлено', value: (p) => p.installedAt, type: 'date', width: 11 },
  {
    header: 'Плановая замена',
    value: (p) => serviceDates(p)?.plannedAt ?? null,
    type: 'date',
    width: 11,
  },
  {
    header: 'Марка / модель',
    value: (p) => machineName(p.equipmentId ? machines.get(p.equipmentId) : undefined),
    width: 16,
  },
  {
    header: 'Гаражный №',
    value: (p) => (p.equipmentId ? (machines.get(p.equipmentId)?.garageNumber ?? null) : null),
    width: 12,
  },
  { header: 'Срок эксплуатации, дн.', value: (p) => p.serviceLifeDays, width: 12 },
  { header: 'Состояние', value: (p) => STATUS_LABEL[p.status], width: 16 },
  { header: 'Статус в 1С', value: (p) => LIFECYCLE_LABEL[p.lifecycle], width: 16 },
]

/**
 * The registry. The server filters, searches, sorts and pages it, so a client
 * with tens of thousands of hoses gets the same page as one with a hundred.
 */
export function ProductsPage() {
  const equipment = useEquipment()
  const machines = useMemo(
    () => new Map((equipment.data ?? []).map((e) => [e.id, e])),
    [equipment.data],
  )
  const columns = useMemo(() => productColumns(machines), [machines])
  const catalog = useCatalogNumbers()
  const [params, setParams] = useSearchParams()
  // Page, sort, search and tab live in the address, so a hose's back link returns to them.
  const list = useListParams(10)
  const q = useDebounced(list.q.trim())
  const tab: Tab = list.tab === 'archive' ? 'archive' : 'active'
  const { sorting, pageSize, pageIndex } = list
  const [filtersOpen, setFiltersOpen] = useState(false)
  const navigate = useNavigate()
  const { branch } = useSession()
  // Hoses ticked for a replacement request, kept with their data across tabs, pages and
  // filters: the page a hose was ticked on is gone once the user moves on.
  const [picked, setPicked] = useState<ReadonlyMap<string, Product>>(() => new Map())
  const [requesting, setRequesting] = useState(false)

  const active = useMemo(() => {
    const values: FilterValues = {}
    for (const key of FILTER_KEYS) {
      const value = params.get(key)
      if (value) values[key] = value
    }
    return values
  }, [params])

  // Everything the list depends on but the page: when any of it changes, back to page one.
  const ask = useMemo<ProductPageQuery>(
    () => ({
      ...(active as ProductPageQuery),
      q: q || undefined,
      archive: tab === 'archive' ? '1' : '0',
      limit: pageSize,
      // Unsorted, the newest-made hoses come first (customer, 2026-10-11); a link with a sort the
      // server does not know (an old bookmark) falls back to the same instead of failing.
      ...(sorting[0] && PRODUCT_SORT_KEYS.includes(sorting[0].id as ProductSortKey)
        ? { sort: sorting[0].id as ProductSortKey, dir: sorting[0].desc ? 'desc' : 'asc' }
        : { sort: 'manufacturedAt', dir: 'desc' }),
    }),
    [active, q, tab, pageSize, sorting],
  )
  const page = useProductPage({ ...ask, page: pageIndex + 1 })
  const everyRow = useProductRows(ask)

  const selected = useMemo(() => new Set(picked.keys()), [picked])
  const chosen = useMemo(() => [...picked.values()], [picked])
  const tooMany = chosen.length > MAX_REQUEST_POSITIONS
  const pick = (ids: Set<string>) =>
    setPicked((before) => {
      const next = new Map<string, Product>()
      for (const id of ids) {
        const p = before.get(id) ?? page.data?.items.find((x) => x.id === id)
        if (p) next.set(id, p)
      }
      return next
    })

  const chipLabel = (key: FilterKey, value: string) => {
    if (key === 'status') return `Состояние: ${STATUS_LABEL[value as ProductStatus]}`
    if (key === 'lifecycle') return `В 1С: ${LIFECYCLE_LABEL[value as ProductLifecycle]}`
    if (key === 'installed') return value === '1' ? 'На технике' : 'Не установлены'
    if (key === 'equipment') {
      const e = equipment.data?.find((x) => x.id === value)
      return `Техника: ${e ? e.garageNumber : value}`
    }
    const c = catalog.data?.find((x) => x.id === value)
    return `Каталожный № (OEM): ${c ? c.name : value}`
  }

  const removeFilter = (key: FilterKey) => {
    params.delete(key)
    params.delete('page')
    setParams(params)
  }
  // New filters keep the list's sort, search, size and tab, and start from page one.
  const applyFilters = (next: URLSearchParamsInit) => {
    const merged = createSearchParams(next)
    for (const key of LIST_KEYS)
      if (key !== 'page' && params.get(key)) merged.set(key, params.get(key)!)
    setParams(merged)
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
                q && `Поиск: «${q}»`,
              ]}
              columns={exportColumns(machines)}
              rows={everyRow}
            />
          </>
        }
      />
      <ProductFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        values={active}
        onApply={applyFilters}
      />
      <QueryState query={page} skeleton={<TableSkeleton />}>
        {(data) => (
          <DataTable
            data={data.items}
            columns={columns as ColumnDef<Product, unknown>[]}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            stickyFirstColumn
            tools
            hiddenByDefault={['clientNumber']}
            server={{
              total: data.total,
              pageIndex,
              pageSize,
              sorting,
              onPageChange: list.setPage,
              onPageSizeChange: list.setPageSize,
              onSortingChange: list.setSorting,
              pending: page.isPlaceholderData,
            }}
            selection={{
              rowId: (p) => p.id,
              selected,
              onChange: pick,
              // A hose still being made has nothing to replace yet.
              canSelect: (p) => p.lifecycle !== 'manufacturing',
              label: (p) => `Выбрать № ${p.serialNumber}`,
            }}
            emptyTitle={tab === 'archive' ? 'В архиве пока ничего нет' : 'Изделий пока нет'}
            toolbar={
              <div className="flex flex-wrap items-center gap-4">
                <Tabs
                  items={[
                    { key: 'active', label: 'Активные', count: data.counts.active },
                    { key: 'archive', label: 'Архив', count: data.counts.archive },
                  ]}
                  value={tab}
                  onChange={(t) => list.setTab(t === 'archive' ? 'archive' : null)}
                  className="border-b-0"
                />
                <p className="text-ui text-ink-muted">
                  {tab === 'archive'
                    ? 'Списанные изделия: сняты с техники и заменены.'
                    : 'Изделия в работе: на технике или ещё на складе.'}
                </p>
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
                value={list.q}
                onChange={(e) => list.setQ(e.target.value)}
                placeholder="Серийный, каталожный, ваш номер, техника…"
              />
            }
          />
        )}
      </QueryState>
      {chosen.length > 0 && (
        <SelectionBar
          label="Выбранные изделия"
          count={chosen.length}
          onClear={() => setPicked(new Map())}
          note={tooMany ? `В заявке до ${MAX_REQUEST_POSITIONS} изделий` : undefined}
        >
          <Button size="sm" icon={RefreshCw} disabled={tooMany} onClick={() => setRequesting(true)}>
            Заявка на замену
          </Button>
        </SelectionBar>
      )}
      {requesting && (
        <RequestForm
          preset={{ kind: 'replace', products: chosen }}
          onClose={() => setRequesting(false)}
          onCreated={() => setPicked(new Map())}
        />
      )}
    </div>
  )
}
