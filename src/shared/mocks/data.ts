import { addDays, format, formatISO, parseISO, setHours, setMinutes, subDays } from 'date-fns'
import type {
  AuditChange,
  AuditEntry,
  BranchSummary,
  CabinetSettings,
  CabinetUser,
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

/** Company settings; `warnPercent` drives every hose status below, as it will on the BFF. */
export const settings: CabinetSettings = {
  warnPercent: 20,
  leadDays: [30, 14, 7],
  channels: { inApp: true, email: false },
}
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
  if (age > lifeDays * (1 - settings.warnPercent / 100)) return 'warn'
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
  // Health from the stored date, as every later recount (and the BFF) derives it.
  const status = statusFor(
    installed ? new Date(iso(installed)) : null,
    cat.serviceLifeDays,
    cat.warrantyDays,
  )
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

/** Derive everything the equipment row says about its hoses from the hoses themselves. */
export function recountEquipment(eq: Equipment) {
  const own = products.filter((p) => p.equipmentId === eq.id && live(p))
  eq.hoseCount = own.length
  eq.statusBreakdown = { ok: 0, warn: 0, replace: 0, no_warranty: 0 }
  for (const p of own) eq.statusBreakdown[p.status]++
  const next = own
    .map((p) => addDays(new Date(p.installedAt!), p.serviceLifeDays))
    .filter((d) => d >= NOW)
    .sort((a, b) => a.getTime() - b.getTime())[0]
  eq.nextPlannedReplacement = next ? iso(next) : null
}

/**
 * Customer-owned facts about a hose. Everything derived from them — health,
 * lifecycle, equipment counts — is recomputed here, the way the BFF will.
 */
export function applyInstallation(
  p: Product,
  patch: Partial<Pick<Product, 'equipmentId' | 'installPlace' | 'installedAt' | 'clientNumber'>>,
) {
  const before = p.equipmentId
  Object.assign(p, patch)
  const installed = p.installedAt ? new Date(p.installedAt) : null
  p.status = statusFor(installed, p.serviceLifeDays, p.warrantyDays)
  if (p.lifecycle !== 'written_off') {
    p.lifecycle = installed
      ? p.status === 'replace'
        ? 'needs_replacement'
        : 'in_operation'
      : 'shipped'
  }
  p.branchId = equipment.find((e) => e.id === p.equipmentId)?.branchId ?? p.branchId
  for (const id of new Set([before, p.equipmentId])) {
    const eq = equipment.find((e) => e.id === id)
    if (eq) recountEquipment(eq)
  }
  return p
}

for (const eq of equipment) {
  recountEquipment(eq)
  eq.lastRepairDate = eq.hoseCount ? iso(subDays(NOW, Math.floor(rand() * 120))) : null
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

/** Re-derive every live hose's health after a threshold change, then the counts built on it. */
export function applySettings(patch: Partial<CabinetSettings>) {
  Object.assign(settings, patch)
  for (const p of products) {
    if (!live(p)) continue
    p.status = statusFor(new Date(p.installedAt!), p.serviceLifeDays, p.warrantyDays)
    p.lifecycle = p.status === 'replace' ? 'needs_replacement' : 'in_operation'
  }
  for (const eq of equipment) recountEquipment(eq)
  return settings
}

const PEOPLE: [string, string][] = [
  ['Иванов Иван', 'ivanov'],
  ['Петрова Анна', 'petrova'],
  ['Сидоров Алексей', 'sidorov'],
  ['Кузнецова Мария', 'kuznetsova'],
  ['Смирнов Дмитрий', 'smirnov'],
  ['Волков Сергей', 'volkov'],
  ['Морозова Елена', 'morozova'],
  ['Новиков Андрей', 'novikov'],
  ['Фёдоров Павел', 'fedorov'],
  ['Лебедева Ольга', 'lebedeva'],
  ['Козлов Николай', 'kozlov'],
  ['Егорова Татьяна', 'egorova'],
]
// u-1 is the signed-in demo user, who reaches the user list only as administrator.
const ROLE_MIX = ['admin', 'engineer', 'manager', 'mechanic', 'mechanic', 'engineer'] as const

export const users: CabinetUser[] = PEOPLE.map(([name, login], i) => {
  const role = ROLE_MIX[i % ROLE_MIX.length]
  return {
    id: `u-${i + 1}`,
    name,
    email: `${login}@roga-kopyta.ru`,
    role,
    branchIds: role === 'mechanic' ? [BRANCHES[i % 2]] : [],
    active: i !== 9,
    lastLoginAt: i === 7 ? null : iso(subDays(NOW, Math.floor(rand() * 40))),
  }
})

const BRANCH_META: Record<string, Pick<BranchSummary, 'name' | 'code' | 'address'>> = {
  'b-main': {
    name: 'Главный филиал',
    code: '000000001',
    address: 'г. Кемерово, ул. Рудничная, 12',
  },
  'b-north': { name: 'Северный филиал', code: '000000002', address: null },
}

/** Branches come from 1С; the counts are what the cabinet holds for each. */
export function branchSummaries(): BranchSummary[] {
  return BRANCHES.map((id) => ({
    id,
    companyId: 'c-1',
    ...BRANCH_META[id],
    equipmentCount: equipment.filter((e) => e.branchId === id).length,
    productCount: products.filter((p) => p.branchId === id && live(p)).length,
    userCount: users.filter(
      (u) => u.active && (u.branchIds.length === 0 || u.branchIds.includes(id)),
    ).length,
  }))
}

// ── Action log ───────────────────────────────────────────────────────────────
// The BFF records every mutation in middleware; the mock does it in the handlers.
// Values are stored as the customer reads them, so the log never needs the
// objects it describes (a deleted user or a renamed branch still reads right).

/** The server's own wording for roles; the UI's labels live in entities/user. */
const ROLE_WORD: Record<CabinetUser['role'], string> = {
  mechanic: 'Механик',
  engineer: 'Инженер',
  manager: 'Руководитель',
  admin: 'Администратор',
}
const day = (isoDate: string | null) => (isoDate ? format(parseISO(isoDate), 'dd.MM.yyyy') : null)
const branchNames = (ids: string[]) =>
  ids.length ? ids.map((id) => BRANCH_META[id]?.name ?? id).join(', ') : 'Все филиалы'

type View = Record<string, string | null>

export const installationView = (p: Product): View => ({
  Техника: equipment.find((e) => e.id === p.equipmentId)?.garageNumber ?? null,
  'Место установки': p.installPlace,
  'Дата установки': day(p.installedAt),
  'Внутренний №': p.clientNumber,
})

export const userView = (u: CabinetUser): View => ({
  ФИО: u.name,
  Почта: u.email,
  Роль: ROLE_WORD[u.role],
  Филиалы: branchNames(u.branchIds),
  Доступ: u.active ? 'Активен' : 'Отключён',
})

export const settingsView = (s: CabinetSettings): View => ({
  '«Внимание» при остатке ресурса': `${s.warnPercent} %`,
  'Предупреждать за, дней': s.leadDays.join(', ') || 'не предупреждать',
  'Письма на почту': s.channels.email ? 'Включены' : 'Выключены',
})

/** The fields that differ between two views; unchanged ones stay out of the log. */
export function diff(before: View, after: View): AuditChange[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => (before[k] ?? null) !== (after[k] ?? null))
    .map((k) => ({ field: k, before: before[k] ?? null, after: after[k] ?? null }))
}

export const audit: AuditEntry[] = []
let auditSeq = 0

/** Log one action. The actor is the signed-in demo user; the BFF takes it from the token. */
export function record(
  entry: Pick<AuditEntry, 'action' | 'target' | 'changes'>,
  at: Date = new Date(),
  actor: CabinetUser = users[0],
) {
  audit.push({
    id: `a-${++auditSeq}`,
    at: at.toISOString(),
    actor: { id: actor.id, name: actor.name },
    ...entry,
  })
  audit.sort((a, b) => b.at.localeCompare(a.at))
}

// A deterministic past, so the log reads like a working month rather than an empty page.
const workTime = (daysAgo: number) =>
  setMinutes(setHours(subDays(NOW, daysAgo), 8 + Math.floor(rand() * 10)), Math.floor(rand() * 60))
const fieldWorkers = users.filter(
  (u) => u.active && (u.role === 'mechanic' || u.role === 'engineer'),
)

for (const p of products.filter((x) => live(x) && x.equipmentId).slice(0, 26)) {
  const now = installationView(p)
  const kind = Math.floor(rand() * 3)
  const before: View =
    kind === 0
      ? { ...now, 'Место установки': pick(PLACES.filter((x) => x !== p.installPlace)) }
      : kind === 1
        ? { ...now, 'Дата установки': day(iso(addDays(new Date(p.installedAt!), 2))) }
        : { ...now, Техника: null, 'Место установки': null, 'Дата установки': null }
  record(
    {
      action: 'installation.update',
      target: { kind: 'product', id: p.id, label: `EHS ${p.serialNumber}` },
      changes: diff(before, now),
    },
    workTime(Math.floor(rand() * 40)),
    pick(fieldWorkers),
  )
}

for (const r of requests) {
  record(
    {
      action: 'request.create',
      target: { kind: 'request', id: r.id, label: r.number },
      changes: [
        { field: 'Тип', before: null, after: r.kind === 'replace' ? 'Замена' : 'Изготовление' },
        { field: 'Количество', before: null, after: String(r.quantity) },
      ],
    },
    setHours(parseISO(r.createdAt), 9 + Math.floor(rand() * 8)),
    pick(fieldWorkers),
  )
}

{
  const admin = users[0]
  const created = users[users.length - 1]
  record(
    {
      action: 'user.create',
      target: { kind: 'user', id: created.id, label: created.name },
      changes: diff({}, userView(created)),
    },
    workTime(33),
    admin,
  )
  for (const u of users.filter((x) => !x.active))
    record(
      {
        action: 'user.deactivate',
        target: { kind: 'user', id: u.id, label: u.name },
        changes: [{ field: 'Доступ', before: 'Активен', after: 'Отключён' }],
      },
      workTime(12),
      admin,
    )
  record(
    {
      action: 'user.password',
      target: { kind: 'user', id: users[4].id, label: users[4].name },
      changes: [],
    },
    workTime(6),
    admin,
  )
  record(
    {
      action: 'settings.update',
      target: { kind: 'settings', id: null, label: 'Настройки компании' },
      changes: [{ field: 'Предупреждать за, дней', before: '30, 14', after: '30, 14, 7' }],
    },
    workTime(25),
    admin,
  )
}
