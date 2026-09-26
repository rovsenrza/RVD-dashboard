import { Link } from 'react-router-dom'
import type { Product, ProductStatus } from '@/entities/types'
import { INSTALL_PLACES, ProductStatusBadge, daysLeft } from '@/entities/product'
import { useEquipmentProducts } from '@/shared/api/queries'
import { cn, plural } from '@/shared/lib/utils'
import { EmptyState, QueryState, Skeleton } from '@/shared/ui'

/** Worst first inside a place: what needs a hand today leads. */
const SEVERITY: Record<ProductStatus, number> = { replace: 0, warn: 1, no_warranty: 2, ok: 3 }
const NO_PLACE = 'Место не указано'

/** Places in the order a mechanic walks the machine; unknown places after, «не указано» last. */
function byPlace(hoses: Product[]) {
  const groups = new Map<string, Product[]>()
  for (const p of hoses) {
    const place = p.installPlace ?? NO_PLACE
    groups.set(place, [...(groups.get(place) ?? []), p])
  }
  const rank = (place: string) =>
    place === NO_PLACE ? Infinity : INSTALL_PLACES.indexOf(place) + 1 || INSTALL_PLACES.length + 1
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'ru'))
    .map(([place, list]) => ({
      place,
      hoses: list.sort(
        (a, b) =>
          SEVERITY[a.status] - SEVERITY[b.status] || a.serialNumber.localeCompare(b.serialNumber),
      ),
    }))
}

function Left({ p }: { p: Product }) {
  const left = daysLeft(p)
  if (left === null) return null
  return (
    <span className={cn('tabular', left < 0 ? 'text-status-replace-ink' : 'text-ink-muted')}>
      {left < 0 ? `просрочено ${-left} дн.` : `${left} дн. до замены`}
    </span>
  )
}

/**
 * Техника → Место установки → РВД: the hoses on one machine, grouped by the
 * place they sit, the ones needing a hand first. Each hose opens its card.
 */
export function HosesByPlace({ equipmentId }: { equipmentId: string }) {
  const query = useEquipmentProducts(equipmentId)
  return (
    <QueryState query={query} skeleton={<Skeleton className="h-32 w-full" />}>
      {(hoses) =>
        hoses.length === 0 ? (
          <EmptyState inset title="На этой технике нет изделий" />
        ) : (
          <div className="grid gap-4">
            {byPlace(hoses).map(({ place, hoses: list }) => (
              <section key={place}>
                <h3 className="flex items-baseline gap-2 text-ui font-medium">
                  {place}
                  <span className="text-label font-normal text-ink-muted">
                    {list.length} {plural(list.length, 'рукав', 'рукава', 'рукавов')}
                  </span>
                </h3>
                <ul className="mt-1 divide-y divide-line">
                  {list.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/products/${p.id}`}
                        className="-mx-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 text-ui transition-colors duration-100 hover:bg-row-hover sm:grid-cols-[6.5rem_minmax(0,1fr)_auto_10rem]"
                      >
                        <span className="font-medium text-brand-deep tabular">
                          EHS {p.serialNumber}
                        </span>
                        <span className="truncate text-ink-secondary max-sm:text-right">
                          {p.catalogNumber ?? p.type}
                        </span>
                        <ProductStatusBadge status={p.status} />
                        <span className="text-label max-sm:text-right sm:text-right">
                          <Left p={p} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      }
    </QueryState>
  )
}
