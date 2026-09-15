import { addDays, formatISO, subDays } from 'date-fns'
import type {
  DashboardSummary,
  Equipment,
  Product,
  ProductStatus,
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
  ['Komatsu', 'PC400'],
  ['Caterpillar', '374F'],
  ['Hitachi', 'EX1200'],
  ['Liebherr', 'R9350'],
  ['БелАЗ', '75131'],
] as const
const HOSE_TYPES = ['2SN DN12', '4SP DN20', '4SH DN25', 'R13 DN32', '1SN DN10']
const MANUFACTURERS = ['Manuli', 'Parker', 'Gates', 'Alfagomma']
const PLACES = ['Стрела, левый контур', 'Рукоять', 'Ковш', 'Гидромотор хода', 'Насос, напор']

export const equipment: Equipment[] = Array.from({ length: 26 }, (_, i) => {
  const [brand, model] = pick(BRANDS)
  return {
    id: `eq-${i + 1}`,
    branchId: BRANCHES[i % 2],
    brand,
    model,
    garageNumber: `${pick(['EX', 'HT', 'BB'])}${String(i + 4).padStart(2, '0')}`,
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

export const products: Product[] = Array.from({ length: 420 }, (_, i) => {
  const eq = rand() < 0.9 ? pick(equipment) : null
  const shipped = subDays(NOW, Math.floor(rand() * 500))
  const installed = eq ? addDays(shipped, Math.floor(rand() * 20)) : null
  const lifeDays = pick([180, 270, 365, 365, 540])
  const warrantyDays = pick([90, 180, 365])
  const status = statusFor(installed, lifeDays, warrantyDays)
  if (eq) {
    eq.hoseCount++
    eq.statusBreakdown[status]++
  }
  return {
    id: `p-${i + 1}`,
    serialNumber: String(48700 + i),
    clientNumber: rand() < 0.5 ? `K-${1000 + i}` : null,
    oemNumber:
      rand() < 0.7 ? `${7400 + Math.floor(rand() * 90)}-${Math.floor(rand() * 9000)}` : null,
    type: pick(HOSE_TYPES),
    manufacturer: pick(MANUFACTURERS),
    specs: `L=${800 + Math.floor(rand() * 20) * 50} мм, P=${pick([210, 280, 350, 420])} bar`,
    manufacturedAt: iso(subDays(shipped, 10)),
    shippedAt: iso(shipped),
    installedAt: installed ? iso(installed) : null,
    warrantyDays,
    serviceLifeDays: lifeDays,
    status,
    equipmentId: eq?.id ?? null,
    installPlace: eq ? pick(PLACES) : null,
    branchId: eq?.branchId ?? BRANCHES[0],
  }
})

for (const eq of equipment) {
  const own = products.filter((p) => p.equipmentId === eq.id && p.installedAt)
  const next = own
    .map((p) => addDays(new Date(p.installedAt!), p.serviceLifeDays))
    .filter((d) => d >= NOW)
    .sort((a, b) => a.getTime() - b.getTime())[0]
  eq.nextPlannedReplacement = next ? iso(next) : null
  eq.lastRepairDate = own.length ? iso(subDays(NOW, Math.floor(rand() * 120))) : null
}

export const replacements: Replacement[] = Array.from({ length: 94 }, (_, i) => {
  const old = pick(products.filter((p) => p.equipmentId))
  return {
    id: `r-${i + 1}`,
    oldProductId: old.id,
    newProductId: pick(products).id,
    equipmentId: old.equipmentId!,
    date: iso(subDays(NOW, Math.floor(rand() * 365))),
    reason: pick(['Гарантийная замена', 'Плановая замена', 'Поломка', 'Износ']),
    operatingHours: rand() < 0.6 ? Math.floor(rand() * 12000) : null,
    performedBy: pick(['Иванов И.', 'Петров П.', 'Сидоров С.']),
    comment: null,
  }
})

export const requests: ServiceRequest[] = Array.from({ length: 12 }, (_, i) => ({
  id: `req-${i + 1}`,
  productId: pick(products).id,
  kind: rand() < 0.5 ? 'replace' : 'manufacture',
  quantity: 1 + Math.floor(rand() * 4),
  comment: null,
  status: pick(['new', 'in_progress', 'done', 'rejected']),
  createdAt: iso(subDays(NOW, Math.floor(rand() * 60))),
}))

export function dashboardSummary(): DashboardSummary {
  const breakdown: Record<ProductStatus, number> = { ok: 0, warn: 0, replace: 0, no_warranty: 0 }
  for (const p of products) breakdown[p.status]++
  const byMonth = new Map<string, number>()
  for (const r of replacements) {
    const m = r.date.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1)
  }
  const upcoming = products
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
    shippedTotal: products.length,
    inOperation: products.filter((p) => p.installedAt).length,
    onWarranty: products.filter((p) => p.status === 'ok').length,
    expiringSoon: breakdown.warn,
    needsReplacement: breakdown.replace,
    replacementsInPeriod: replacements.filter((r) => r.date >= iso(subDays(NOW, 30))).length,
    deltas: { shippedTotal: 19, replacements: 6, onWarranty: -31, needsReplacement: 31 },
    statusBreakdown: breakdown,
    replacementsByMonth: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count })),
    upcoming,
  }
}
