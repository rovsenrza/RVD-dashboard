import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'
import type { Product, ProductLifecycle, ProductSortKey, ProductStatus } from '@/entities/types'
import { LIFECYCLE_LABEL, STATUS_LABEL } from '@/entities/product'
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
import { productColumns } from './columns'
import { ProductFilters } from './components/ProductFilters'
import { FILTER_KEYS, type FilterKey, type FilterValues } from './filters'

type Tab = 'active' | 'archive'

const EXPORT_COLUMNS: ExportColumn<Product>[] = [
  { header: 'Серийный № (EHS)', value: (p) => p.serialNumber, width: 14 },
  { header: 'Ваш внутренний №', value: (p) => p.clientNumber, width: 14 },
  { header: 'Каталожный № (OEM)', value: (p) => p.catalogNumber, width: 18 },
  { header: 'Тип', value: (p) => p.type, width: 12 },
  { header: 'Производитель', value: (p) => p.manufacturer, width: 14 },
  { header: 'Отгружено', value: (p) => p.shippedAt, type: 'date', width: 11 },
  { header: 'Установлено', value: (p) => p.installedAt, type: 'date', width: 11 },
  { header: 'Место установки', value: (p) => p.installPlace, width: 20 },
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
  const catalog = useCatalogNumbers()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const [tab, setTab] = useState<Tab>('active')
  const [sorting, setSorting] = useState<SortingState>([])
  const [pageSize, setPageSize] = useState(10)
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
      ...(sorting[0] && {
        sort: sorting[0].id as ProductSortKey,
        dir: sorting[0].desc ? 'desc' : 'asc',
      }),
    }),
    [active, q, tab, pageSize, sorting],
  )
  const askKey = JSON.stringify(ask)
  const [paging, setPaging] = useState({ key: askKey, index: 0 })
  // Adjusted while rendering, so clearing a search lands on page one, not on the page before it.
  if (paging.key !== askKey) setPaging({ key: askKey, index: 0 })
  const pageIndex = paging.key === askKey ? paging.index : 0
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
                q && `Поиск: «${q}»`,
              ]}
              columns={EXPORT_COLUMNS}
              rows={everyRow}
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
      <QueryState query={page} skeleton={<TableSkeleton />}>
        {(data) => (
          <DataTable
            data={data.items}
            columns={productColumns as ColumnDef<Product, unknown>[]}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            stickyFirstColumn
            tools
            hiddenByDefault={['clientNumber', 'manufacturer']}
            server={{
              total: data.total,
              pageIndex,
              pageSize,
              sorting,
              onPageChange: (index) => setPaging({ key: askKey, index }),
              onPageSizeChange: setPageSize,
              onSortingChange: setSorting,
              pending: page.isPlaceholderData,
            }}
            selection={{
              rowId: (p) => p.id,
              selected,
              onChange: pick,
              // A hose still being made has nothing to replace yet.
              canSelect: (p) => p.lifecycle !== 'manufacturing',
              label: (p) => `Выбрать EHS ${p.serialNumber}`,
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
                  onChange={setTab}
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
