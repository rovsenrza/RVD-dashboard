import type { Product } from '@rvd/contracts'

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
