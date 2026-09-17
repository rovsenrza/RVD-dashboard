import { addDays, formatISO, subDays } from 'date-fns'
import type {
  CatalogNumber,
  ComponentItem,
  ComponentType,
  DashboardSummary,
  Equipment,
  Product,
  ProductLifecycle,
  ProductStatus,
  ReleaseDocument,
  Replacement,
  ServiceRequest,
} from '@/entities/types'

// Deterministic pseudo-random so mock data is stable between reloads.
let seed = 42
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]
const iso = (d: Date) => formatISO(d, { representation: 'date' })

const NOW = new Date()
const BRANCHES = ['b-main', 'b-north']
const BRANDS = [
  ['Komatsu', 'PC400', 'Экскаватор'],
  ['Caterpillar', '374F', 'Экскаватор'],
  ['Hitachi', 'EX1200', 'Экскаватор'],
  ['Liebherr', 'R9350', 'Экскаватор'],
  ['БелАЗ', '75131', 'Самосвал'],
] as const
const PLACES = ['Стрела, левый контур', 'Рукоять', 'Ковш', 'Гидромотор хода', 'Насос, напор']

let componentId = 0
const comp = (
  name: string,
  type: ComponentType,
  spec: string,
  manufacturer: string | null,
): ComponentItem => ({
  id: `c-${++componentId}`,
  code: String(10_000 + componentId),
  name,
  spec,
  manufacturer,
  type,
})

export const components: ComponentItem[] = [
  comp('2SC ду06 рукав Rock Arctic p=400 BAR', 'hose', 'ду06', 'Rock'),
  comp('2SN ду12 рукав Manuli p=275 BAR', 'hose', 'ду12', 'Manuli'),
  comp('4SP ду20 рукав Gates p=380 BAR', 'hose', 'ду20', 'Gates'),
  comp('4SH ду20 рукав Rock Arctic p=420 BAR', 'hose', 'ду20', 'Rock'),
  comp('R13 ду32 рукав Alfagomma p=420 BAR', 'hose', 'ду32', 'Alfagomma'),
  comp('2SN dn 06 Муфта', 'coupling', 'ду06', null),
  comp('Муфта 2SN ду12', 'coupling', 'ду12', null),
  comp('Муфта 4SH/4SP ду20', 'coupling', 'ду20', null),
  comp('Муфта R13 ду32', 'coupling', 'ду32', null),
  comp('Фитинг DKOL 14x1.5 (0) ду06', 'fitting', 'ду06', 'Parker'),
  comp('ORFS 1 (90) ду12 фитинг', 'fitting', 'ду12', 'Parker'),
  comp('ORFS 1-3/16 (0) ду20 фитинг', 'fitting', 'ду20', 'Parker'),
  comp('SF 38.1 (90) ду20 фитинг', 'fitting', 'ду20', 'Parker'),
  comp('SF 44.5 (45) ду32 фитинг', 'fitting', 'ду32', 'Parker'),
  comp('Пружина защитная ду20', 'protection', 'ду20', null),
]

const byName = (name: string) => components.find((c) => c.name === name)!

const CATALOG_SPECS = [
  { name: '02753-00613', hose: '4SH ду20 рукав Rock Arctic p=420 BAR', life: 730, warranty: 365 },
  { name: '07098-010A9', hose: '2SC ду06 рукав Rock Arctic p=400 BAR', life: 365, warranty: 180 },
  { name: '03016-119913', hose: '2SN ду12 рукав Manuli p=275 BAR', life: 540, warranty: 180 },
  { name: '198-71-32120', hose: '4SP ду20 рукав Gates p=380 BAR', life: 365, warranty: 365 },
  { name: '198-61-43320', hose: 'R13 ду32 рукав Alfagomma p=420 BAR', life: 270, warranty: 90 },
] as const

/** Состав рукава в сборе: сам рукав + две муфты + два фитинга того же диаметра. */
export const catalogNumbers: CatalogNumber[] = CATALOG_SPECS.map((s, i) => {
  const hose = byName(s.hose)
  const spec = hose.spec!
  const coupling = components.find((c) => c.type === 'coupling' && c.spec === spec)!
  const fitting = components.find((c) => c.type === 'fitting' && c.spec === spec)!
  return {
    id: `cat-${i + 1}`,
    code: String(500 + i),
    name: s.name,
    serviceLifeDays: s.life,
    warrantyDays: s.warranty,
    diameter: Number(spec.replace('ду', '')),
    braidCount: hose.name.startsWith('4') || hose.name.startsWith('R13') ? 4 : 2,
    composition: [
      { componentId: hose.id, name: hose.name, quantity: 1 },
      { componentId: coupling.id, name: coupling.name, quantity: 2 },
      { componentId: fitting.id, name: fitting.name, quantity: 2 },
    ],
  }
})

export const equipment: Equipment[] = Array.from({ length: 26 }, (_, i) => {
  const [brand, model, type] = pick(BRANDS)
  return {
    id: `eq-${i + 1}`,
    branchId: BRANCHES[i % 2],
    type,
    brand,
    model,
    garageNumber: `${pick(['EX', 'HT', 'BB'])}${String(i + 4).padStart(2, '0')}`,
    inventoryNumber: rand() < 0.7 ? `ИНВ-${String(4200 + i)}` : null,
    hoseCount: 0,
    lastRepairDate: null,
    nextPlannedReplacement: null,
    statusBreakdown: { ok: 0, warn: 0, replace: 0, no_warranty: 0 },
  }
})

function statusFor(
  installedAt: Date | null,
  lifeDays: number,
  warrantyDays: number,
): ProductStatus {
  if (!installedAt) return 'no_warranty'
  const age = (NOW.getTime() - installedAt.getTime()) / 86_400_000
  if (age > lifeDays) return 'replace'
  if (age > lifeDays * 0.8) return 'warn'
  if (age > warrantyDays) return 'no_warranty'
  return 'ok'
}

function lifecycleFor(installed: Date | null, status: ProductStatus): ProductLifecycle {
  if (!installed) return rand() < 0.5 ? 'in_stock' : 'shipped'
  return status === 'replace' ? 'needs_replacement' : 'in_operation'
}

export const products: Product[] = Array.from({ length: 420 }, (_, i) => {
  const eq = rand() < 0.9 ? pick(equipment) : null
  const cat = pick(catalogNumbers)
  const hose = components.find((c) => c.id === cat.composition[0].componentId)!
  const shipped = subDays(NOW, Math.floor(rand() * 500))
  const installed = eq ? addDays(shipped, Math.floor(rand() * 20)) : null
  const status = statusFor(installed, cat.serviceLifeDays, cat.warrantyDays)
  return {
    id: `p-${i + 1}`,
    serialNumber: String(48700 + i),
    clientNumber: rand() < 0.5 ? `K-${1000 + i}` : null,
    oemNumber:
      rand() < 0.7 ? `${7400 + Math.floor(rand() * 90)}-${Math.floor(rand() * 9000)}` : null,
    catalogNumberId: cat.id,
    catalogNumber: cat.name,
    nomenclatureNumber: `РВД ${cat.name}`,
    type: hose.name.split(' ').slice(0, 2).join(' '),
    manufacturer: hose.manufacturer ?? '—',
    specs: `L=${800 + Math.floor(rand() * 20) * 50} мм, P=${pick([210, 280, 350, 420])} bar`,
    diameter: cat.diameter,
    braidCount: cat.braidCount,
    composition: cat.composition,
    manufacturedAt: iso(subDays(shipped, 10)),
    shippedAt: iso(shipped),
    installedAt: installed ? iso(installed) : null,
    warrantyDays: cat.warrantyDays,
    serviceLifeDays: cat.serviceLifeDays,
    status,
    lifecycle: lifecycleFor(installed, status),
    replacedProductId: null,
    equipmentId: eq?.id ?? null,
    installPlace: eq ? pick(PLACES) : null,
    branchId: eq?.branchId ?? BRANCHES[0],
  }
})

export const replacements: Replacement[] = Array.from({ length: 94 }, (_, i) => {
  const old = pick(products.filter((p) => p.equipmentId && p.lifecycle !== 'written_off'))
  const fresh = pick(products.filter((p) => p.id !== old.id))
  fresh.replacedProductId = old.id
  // The hose that was taken off is retired; it stays linked to its equipment
  // only as history and no longer counts toward what is on the machine.
  old.lifecycle = 'written_off'
  return {
    id: `r-${i + 1}`,
    oldProductId: old.id,
    oldSerialNumber: old.serialNumber,
    newProductId: fresh.id,
    newSerialNumber: fresh.serialNumber,
    equipmentId: old.equipmentId!,
    garageNumber: equipment.find((e) => e.id === old.equipmentId)!.garageNumber,
    date: iso(subDays(NOW, Math.floor(rand() * 365))),
    reason: pick(['Гарантийная замена', 'Плановая замена', 'Поломка', 'Износ']),
    operatingHours: rand() < 0.6 ? Math.floor(rand() * 12000) : null,
    performedBy: pick(['Иванов И.', 'Петров П.', 'Сидоров С.']),
    comment: null,
  }
})

/** What is on the machine right now: installed and not retired. */
const live = (p: Product) => p.installedAt !== null && p.lifecycle !== 'written_off'

for (const eq of equipment) {
  const own = products.filter((p) => p.equipmentId === eq.id && live(p))
  eq.hoseCount = own.length
  eq.statusBreakdown = { ok: 0, warn: 0, replace: 0, no_warranty: 0 }
  for (const p of own) eq.statusBreakdown[p.status]++
  const next = own
    .map((p) => addDays(new Date(p.installedAt!), p.serviceLifeDays))
    .filter((d) => d >= NOW)
    .sort((a, b) => a.getTime() - b.getTime())[0]
  eq.nextPlannedReplacement = next ? iso(next) : null
  eq.lastRepairDate = own.length ? iso(subDays(NOW, Math.floor(rand() * 120))) : null
}

const AUTHORS = ['Иванов И. И.', 'Петров П. П.', 'Сидоров С. С.']
const LIFECYCLE_CHAIN: ProductLifecycle[] = [
  'manufacturing',
  'in_stock',
  'shipped',
  'in_operation',
  'needs_replacement',
  'written_off',
]

let documentNumber = 0
export const releaseDocuments: ReleaseDocument[] = products.flatMap((p) => {
  const reached = LIFECYCLE_CHAIN.indexOf(p.lifecycle)
  const start = new Date(p.manufacturedAt)
  // A hose retired on a planned swap never passed through «требует замены».
  const passed = LIFECYCLE_CHAIN.slice(0, reached + 1).filter(
    (step) => step !== 'needs_replacement' || p.status === 'replace',
  )
  return passed.map((lifecycle, step) => ({
    id: `doc-${p.id}-${step}`,
    number: `ВЫП-${String(++documentNumber).padStart(6, '0')}`,
    date: iso(addDays(start, step * 5)),
    productId: p.id,
    lifecycle,
    author: AUTHORS[step % AUTHORS.length],
    requestId: null,
  }))
})

export const requests: ServiceRequest[] = Array.from({ length: 12 }, (_, i) => {
  const product = pick(products)
  const cat = catalogNumbers.find((c) => c.id === product.catalogNumberId)!
  const quantity = 1 + Math.floor(rand() * 4)
  return {
    id: `req-${i + 1}`,
    number: `СВЦБ-${String(5100 + i).padStart(5, '0')}`,
    branchId: product.branchId,
    productId: product.id,
    kind: rand() < 0.5 ? 'replace' : 'manufacture',
    positions: [
      {
        catalogNumberId: cat.id,
        catalogNumber: cat.name,
        equipmentId: product.equipmentId,
        quantity,
      },
    ],
    quantity,
    comment: null,
    status: pick(['new', 'in_progress', 'done', 'rejected']),
    shipmentStatus: rand() < 0.4 ? 'shipped' : 'not_shipped',
    createdAt: iso(subDays(NOW, Math.floor(rand() * 60))),
  }
})

export function dashboardSummary(branch: string | null = null): DashboardSummary {
  // Retired hoses live in the archive; the dashboard is about what is in hand.
  const scopedProducts = products.filter(
    (p) => p.lifecycle !== 'written_off' && (!branch || p.branchId === branch),
  )
  const branchEquipment = new Set(
    equipment.filter((e) => !branch || e.branchId === branch).map((e) => e.id),
  )
  const scopedReplacements = branch
    ? replacements.filter((r) => branchEquipment.has(r.equipmentId))
    : replacements

  const breakdown: Record<ProductStatus, number> = { ok: 0, warn: 0, replace: 0, no_warranty: 0 }
  for (const p of scopedProducts) breakdown[p.status]++
  const byMonth = new Map<string, number>()
  for (const r of scopedReplacements) {
    const m = r.date.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1)
  }
  const upcoming = scopedProducts
    .filter((p) => p.installedAt && p.status !== 'replace')
    .map((p) => ({
      productId: p.id,
      serialNumber: p.serialNumber,
      equipment: equipment.find((e) => e.id === p.equipmentId)?.garageNumber ?? '—',
      dueDate: iso(addDays(new Date(p.installedAt!), p.serviceLifeDays)),
    }))
    .filter((u) => u.dueDate >= iso(NOW))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8)

  return {
    shippedTotal: scopedProducts.length,
    inOperation: scopedProducts.filter((p) => p.installedAt).length,
    onWarranty: scopedProducts.filter((p) => p.status === 'ok').length,
    expiringSoon: breakdown.warn,
    needsReplacement: breakdown.replace,
    replacementsInPeriod: scopedReplacements.filter((r) => r.date >= iso(subDays(NOW, 30))).length,
    deltas: { shippedTotal: 19, replacements: 6, onWarranty: -31, needsReplacement: 31 },
    statusBreakdown: breakdown,
    replacementsByMonth: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count })),
    upcoming,
  }
}
