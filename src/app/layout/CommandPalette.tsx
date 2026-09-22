import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Package, ScanLine, Truck } from 'lucide-react'
import { useEquipment, useProducts } from '@/shared/api/queries'
import { SearchInput } from '@/shared/ui'
import { cn } from '@/shared/lib/utils'

interface Hit {
  id: string
  /** Where the hit leads; actions run instead. */
  to?: string
  run?: () => void
  title: string
  subtitle: string
  group: 'action' | 'product' | 'equipment'
}

/** Words that surface the scan action while typing. */
const SCAN_WORDS = ['скан', 'код', 'камер', 'scan', 'qr']

const MAX_PER_GROUP = 5

/**
 * Client-side match over the full list — fine against mocks, but search moves
 * server-side at Д5: the reference registry holds ~170k hoses.
 */
function useHits(q: string): Hit[] {
  const products = useProducts()
  const equipment = useEquipment()

  return useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (needle.length < 2) return []

    const productHits = (products.data ?? [])
      .filter((p) =>
        [p.serialNumber, p.clientNumber, p.oemNumber, p.catalogNumber, p.type].some((v) =>
          v?.toLowerCase().includes(needle),
        ),
      )
      .slice(0, MAX_PER_GROUP)
      .map<Hit>((p) => ({
        id: p.id,
        to: `/products/${p.id}`,
        title: `EHS ${p.serialNumber}`,
        subtitle: [p.type, p.catalogNumber].filter(Boolean).join(' · '),
        group: 'product',
      }))

    const equipmentHits = (equipment.data ?? [])
      .filter((e) =>
        [e.garageNumber, e.brand, e.model, e.inventoryNumber].some((v) =>
          v?.toLowerCase().includes(needle),
        ),
      )
      .slice(0, MAX_PER_GROUP)
      .map<Hit>((e) => ({
        id: e.id,
        to: `/equipment/${e.id}`,
        title: e.garageNumber,
        subtitle: `${e.brand} ${e.model} · ${e.hoseCount} РВД`,
        group: 'equipment',
      }))

    return [...productHits, ...equipmentHits]
  }, [q, products.data, equipment.data])
}

export function CommandPalette({
  open,
  onClose,
  onScan,
}: {
  open: boolean
  onClose: () => void
  /** Offered as the first action, so a desktop with a webcam can scan too. */
  onScan?: () => void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const found = useHits(q)
  const needle = q.trim().toLowerCase()
  const actions: Hit[] =
    onScan &&
    (needle.length < 2 || SCAN_WORDS.some((w) => w.startsWith(needle) || needle.startsWith(w)))
      ? [
          {
            id: 'scan',
            group: 'action',
            title: 'Сканировать код',
            subtitle: 'Камерой или вводом номера — откроет изделие или технику',
            run: onScan,
          },
        ]
      : []
  const hits = [...actions, ...found]

  useEffect(() => setActive(0), [q])

  useEffect(() => {
    if (!open) return
    setQ('')
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!open) return null

  const go = (hit: Hit) => {
    onClose()
    if (hit.run) hit.run()
    else if (hit.to) navigate(hit.to)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return onClose()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, hits.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter' && hits[active]) {
      e.preventDefault()
      go(hits[active])
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по кабинету"
        className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-pop shadow-pop"
        onKeyDown={onKey}
      >
        <div className="p-3">
          <SearchInput
            autoFocus
            id="command-palette"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Номер EHS, OEM, каталожный или гаражный номер…"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {needle.length < 2 ? (
            <>
              <Results hits={hits} active={active} onPick={go} onHover={setActive} />
              <p className="px-2 py-6 text-center text-ui text-ink-muted">
                Введите минимум два символа для поиска
              </p>
            </>
          ) : hits.length === 0 ? (
            <p className="px-2 py-6 text-center text-ui text-ink-muted">
              Ничего не найдено по запросу «{q.trim()}»
            </p>
          ) : (
            <Results hits={hits} active={active} onPick={go} onHover={setActive} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

const GROUP_LABEL = { action: 'Действия', product: 'Изделия', equipment: 'Техника' } as const
const GROUP_ICON = { action: ScanLine, product: Package, equipment: Truck }

function Results({
  hits,
  active,
  onPick,
  onHover,
}: {
  hits: Hit[]
  active: number
  onPick: (hit: Hit) => void
  onHover: (index: number) => void
}) {
  let lastGroup: Hit['group'] | null = null
  return (
    <ul>
      {hits.map((hit, i) => {
        const Icon = GROUP_ICON[hit.group]
        const newGroup = hit.group !== lastGroup
        lastGroup = hit.group
        return (
          <li key={`${hit.group}-${hit.id}`}>
            {newGroup && (
              <div className="px-2.5 pt-3 pb-1 text-caption font-medium tracking-wide text-ink-muted uppercase">
                {GROUP_LABEL[hit.group]}
              </div>
            )}
            <div
              role="option"
              aria-selected={i === active}
              onClick={() => onPick(hit)}
              onMouseEnter={() => onHover(i)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2',
                i === active && 'bg-wash',
              )}
            >
              <Icon size={15} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-medium">{hit.title}</span>
                <span className="block truncate text-label text-ink-muted">{hit.subtitle}</span>
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
