/**
 * Domain model derived from the customer's ТЗ (not from 1C).
 * 1C OData payloads are mapped onto these types in shared/api adapters,
 * so UI stays stable while the 1C configuration evolves.
 */

export type ProductStatus = 'ok' | 'warn' | 'replace' | 'no_warranty'

export interface Company {
  id: string
  name: string
}

export interface Branch {
  id: string
  companyId: string
  name: string
}

export interface Equipment {
  id: string
  branchId: string
  brand: string
  model: string
  /** Заводской / гаражный номер */
  garageNumber: string
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
  type: string
  manufacturer: string
  specs: string
  manufacturedAt: string
  shippedAt: string
  installedAt: string | null
  /** Гарантия, дней */
  warrantyDays: number
  /** Расчётный срок эксплуатации, дней */
  serviceLifeDays: number
  status: ProductStatus
  equipmentId: string | null
  installPlace: string | null
  branchId: string
}

export interface Replacement {
  id: string
  oldProductId: string
  newProductId: string | null
  equipmentId: string
  date: string
  reason: string
  /** Наработка / моточасы */
  operatingHours: number | null
  performedBy: string
  comment: string | null
}

export type RequestStatus = 'new' | 'in_progress' | 'done' | 'rejected'

export interface ServiceRequest {
  id: string
  productId: string | null
  kind: 'replace' | 'manufacture'
  quantity: number
  comment: string | null
  status: RequestStatus
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
