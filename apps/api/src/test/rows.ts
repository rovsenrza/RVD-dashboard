import type { Equipment, Product } from '@rvd/contracts'

/** A machine with every field filled; its garage number is its id unless the test says otherwise. */
export const machine = (id: string, over: Partial<Equipment> = {}): Equipment => ({
  id,
  branchId: 'b1',
  type: '',
  brand: '',
  model: '',
  garageNumber: id,
  factoryNumber: null,
  inventoryNumber: null,
  department: null,
  hoseCount: 0,
  lastRepairDate: null,
  nextPlannedReplacement: null,
  statusBreakdown: { ok: 0, warn: 0, replace: 0, no_warranty: 0 },
  ...over,
})

/** A cache row with every field filled; tests override what they are about. */
export const product = (over: Partial<Product> & { id: string }): Product => ({
  serialNumber: '1',
  clientNumber: null,
  catalogNumberId: null,
  catalogNumber: null,
  nomenclatureNumber: null,
  type: '2SC ду10',
  manufacturer: '',
  specs: '',
  diameter: 10,
  braidCount: 2,
  composition: [],
  manufacturedAt: null,
  shippedAt: null,
  installedAt: null,
  warrantyDays: 180,
  serviceLifeDays: 365,
  status: 'ok',
  lifecycle: 'in_operation',
  replacedProductId: null,
  equipmentId: null,
  installPlace: null,
  branchId: 'b1',
  ...over,
})
