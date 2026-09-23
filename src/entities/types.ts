/**
 * Domain model derived from the customer's ТЗ (not from 1C).
 * 1C OData payloads are mapped onto these types in shared/api adapters,
 * so UI stays stable while the 1C configuration evolves.
 */

/**
 * Состояние ресурса — считается у нас из installedAt + serviceLifeDays.
 * Это основная ось интерфейса: клиент смотрит, что скоро выйдет из строя.
 */
export type ProductStatus = 'ok' | 'warn' | 'replace' | 'no_warranty'

/**
 * Статус жизненного цикла из 1С — независимая от ProductStatus ось:
 * изделие «Отгружено» ещё не имеет состояния ресурса, а «В эксплуатации» имеет.
 */
export type ProductLifecycle =
  'manufacturing' | 'in_stock' | 'shipped' | 'in_operation' | 'needs_replacement' | 'written_off'

/**
 * Cabinet roles from the ТЗ. Scope, not just permissions: a mechanic works
 * inside one branch, everyone else across the company.
 */
export type UserRole = 'mechanic' | 'engineer' | 'manager' | 'admin'

export interface Company {
  id: string
  name: string
}

export interface Branch {
  id: string
  companyId: string
  name: string
}

/** Тип комплектующего в справочнике «Каталог и комплектующие». */
export type ComponentType = 'hose' | 'fitting' | 'coupling' | 'splice' | 'protection' | 'other'

export interface ComponentItem {
  id: string
  code: string
  name: string
  /** Показатель — типоразмер или характеристика */
  spec: string | null
  manufacturer: string | null
  type: ComponentType
}

/** Строка состава рукава в сборе: рукав + муфты + фитинги. */
export interface CompositionLine {
  componentId: string
  name: string
  quantity: number
}

/**
 * Каталожный номер — эталонный типоразмер, по которому собирается изделие.
 * Задаёт сроки, геометрию и состав по умолчанию.
 */
export interface CatalogNumber {
  id: string
  code: string
  /** Артикул производителя техники, напр. 02753-00613 */
  name: string
  serviceLifeDays: number
  warrantyDays: number
  /** Внутренний диаметр, мм */
  diameter: number
  /** Количество оплёток / навивок */
  braidCount: number
  composition: CompositionLine[]
}

export interface Equipment {
  id: string
  branchId: string
  /** Тип техники: экскаватор, самосвал, погрузчик… */
  type: string
  brand: string
  model: string
  /** Заводской / гаражный номер */
  garageNumber: string
  inventoryNumber: string | null
  hoseCount: number
  lastRepairDate: string | null
  nextPlannedReplacement: string | null
  statusBreakdown: Record<ProductStatus, number>
}

export interface Product {
  id: string
  /** Уникальный номер РВД (EHS / ЕГС) */
  serialNumber: string
  /** Внутренний номер клиента */
  clientNumber: string | null
  oemNumber: string | null
  /** Каталожный номер — ссылка на эталонный типоразмер */
  catalogNumberId: string | null
  catalogNumber: string | null
  nomenclatureNumber: string | null
  type: string
  manufacturer: string
  specs: string
  /** Внутренний диаметр, мм */
  diameter: number
  /** Количество оплёток / навивок */
  braidCount: number
  composition: CompositionLine[]
  manufacturedAt: string
  shippedAt: string
  installedAt: string | null
  /** Гарантия, дней */
  warrantyDays: number
  /** Расчётный срок эксплуатации, дней */
  serviceLifeDays: number
  status: ProductStatus
  lifecycle: ProductLifecycle
  /** Изделие, на замену которому пришло это */
  replacedProductId: string | null
  equipmentId: string | null
  installPlace: string | null
  branchId: string
}

/**
 * Документ выпуска — каждая смена статуса изделия в 1С оформляется
 * отдельным документом; из них складывается история ЖЦ на карточке.
 */
export interface ReleaseDocument {
  id: string
  number: string
  date: string
  productId: string
  /** Статус, который документ присвоил изделию */
  lifecycle: ProductLifecycle
  author: string
  requestId: string | null
}

/** A journal row: ids for navigation plus the numbers a person reads them by. */
export interface Replacement {
  id: string
  oldProductId: string
  oldSerialNumber: string
  newProductId: string | null
  newSerialNumber: string | null
  equipmentId: string
  garageNumber: string
  date: string
  reason: string
  /** Наработка at the moment of the swap, in `usageUnit` */
  operatingHours: number | null
  /** Моточасы for most machines, kilometres for trucks */
  usageUnit: 'hours' | 'km'
  performedBy: string
  comment: string | null
}

export type RequestStatus = 'new' | 'in_progress' | 'done' | 'rejected'

export type ShipmentStatus = 'not_shipped' | 'shipped'

/** Позиция заявки — в 1С это строка табличной части «Заказа клиента». */
export interface RequestPosition {
  catalogNumberId: string | null
  catalogNumber: string | null
  /** Техника, на которую пойдёт изделие; null — «без привязки к технике» */
  equipmentId: string | null
  quantity: number
}

/**
 * Заявка клиента. В 1С ей соответствует документ «Заказ клиента»
 * с номером вида СВЦБ-XXXXX, который синхронизируется с базой УТ.
 */
export interface ServiceRequest {
  id: string
  /** Номер документа в 1С */
  number: string
  branchId: string
  productId: string | null
  kind: 'replace' | 'manufacture'
  positions: RequestPosition[]
  quantity: number
  comment: string | null
  status: RequestStatus
  shipmentStatus: ShipmentStatus
  createdAt: string
}

export interface DashboardSummary {
  shippedTotal: number
  inOperation: number
  onWarranty: number
  expiringSoon: number
  needsReplacement: number
  replacementsInPeriod: number
  deltas: {
    shippedTotal: number
    replacements: number
    onWarranty: number
    needsReplacement: number
  }
  statusBreakdown: Record<ProductStatus, number>
  replacementsByMonth: { month: string; count: number }[]
  upcoming: { productId: string; serialNumber: string; equipment: string; dueDate: string }[]
}

/** Someone with access to the cabinet. Lives in the cabinet, not in 1С. */
export interface CabinetUser {
  id: string
  name: string
  email: string
  role: UserRole
  /** Branches the user works in; empty means the whole company. A mechanic has exactly one. */
  branchIds: string[]
  active: boolean
  lastLoginAt: string | null
}

/** A branch as 1С knows it (read-only here), with what the cabinet holds for it. */
export interface BranchSummary extends Branch {
  code: string
  address: string | null
  equipmentCount: number
  productCount: number
  userCount: number
}

/** Company-wide settings the administrator owns (PLAN.md §5, questions 4 and 7). */
export interface CabinetSettings {
  /** A hose turns «Внимание» when less than this share of its service life is left, %. */
  warnPercent: number
  /** Days before a due date (warranty end, planned replacement, overrun) to notify. */
  leadDays: number[]
  channels: { inApp: boolean; email: boolean }
}

export type AuditAction =
  | 'installation.update'
  | 'request.create'
  | 'user.create'
  | 'user.update'
  | 'user.deactivate'
  | 'user.activate'
  | 'user.password'
  | 'settings.update'
  | 'replacement.create'

export type AuditTargetKind = 'product' | 'request' | 'user' | 'settings'

/** One changed field, already in the customer's words: the log is read by people, not processed. */
export interface AuditChange {
  field: string
  before: string | null
  after: string | null
}

/** Who did what to which object and when, with the fields as they were before and after. */
export interface AuditEntry {
  id: string
  /** ISO date-time */
  at: string
  actor: { id: string; name: string }
  action: AuditAction
  target: { kind: AuditTargetKind; id: string | null; label: string }
  changes: AuditChange[]
}

/** Hoses on one machine model, for comparing models side by side (Д15). Computed server-side. */
export interface ModelStats {
  /** «Komatsu PC400» — brand and model, the way people name the machine */
  model: string
  type: string
  machines: number
  /** Hoses on those machines now */
  hoses: number
  breakdown: Record<ProductStatus, number>
  replacements12m: number
  /** Replacements per machine over the last 12 months */
  replacementsPerMachine: number
  /** Share of those replacements caused by a failure, 0..1 */
  failureShare: number
  /** Average days a hose served before it was replaced */
  avgServiceDays: number | null
  avgUsage: { value: number; unit: 'hours' | 'km' } | null
  /** The installation place replaced most often */
  topPlace: string | null
}
