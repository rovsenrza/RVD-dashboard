import {
  DEFAULT_RULES,
  serviceDates,
  type Equipment,
  type Product,
  type ProductStatus,
  type StatusRules,
} from '@rvd/contracts'
import type { RawClient, RawEquipment, RawNamed } from '../raw.ts'
import { byKey, cleanText, isRef, orNull } from './common.ts'

export interface EquipmentSources {
  equipment: RawEquipment[]
  brands: RawNamed[]
  types: RawNamed[]
  clients: RawClient[]
  /** Already adapted, so each machine's hoses and dates agree with the registry. */
  products: Product[]
  rules?: StatusRules
}

const emptyBreakdown = (): Record<ProductStatus, number> => ({
  ok: 0,
  warn: 0,
  replace: 0,
  no_warranty: 0,
})

/** Machines with what sits on them; written-off hoses no longer count. */
export function toEquipment(src: EquipmentSources): Equipment[] {
  const rules = src.rules ?? DEFAULT_RULES
  const brands = byKey(src.brands, (b) => b.Ref_Key)
  const types = byKey(src.types, (t) => t.Ref_Key)
  const clients = byKey(src.clients, (c) => c.Ref_Key)

  const onMachine = new Map<string, Product[]>()
  for (const p of src.products) {
    if (!p.equipmentId || p.lifecycle === 'written_off') continue
    onMachine.set(p.equipmentId, [...(onMachine.get(p.equipmentId) ?? []), p])
  }

  return src.equipment
    .filter((e) => !e.DeletionMark)
    .map((e): Equipment => {
      const hoses = onMachine.get(e.Ref_Key) ?? []
      const breakdown = emptyBreakdown()
      for (const h of hoses) breakdown[h.status]++
      const due = hoses
        .map((h) => serviceDates(h, rules)?.plannedAt ?? null)
        .filter((d): d is string => d !== null)
        .sort()
      return {
        id: e.Ref_Key,
        branchId: clients.get(e.Owner_Key)?.Филиал_Key ?? '',
        type: isRef(e.Тип_Key) ? cleanText(types.get(e.Тип_Key)?.Description) : '',
        brand: isRef(e.Марка_Key) ? cleanText(brands.get(e.Марка_Key)?.Description) : '',
        // The model catalogue is not published yet; the garage number names the machine meanwhile.
        model: '',
        garageNumber: cleanText(e.ГаражныйНомер),
        factoryNumber: null,
        inventoryNumber: orNull(e.ИнвентарныйНомер),
        department: null,
        hoseCount: hoses.length,
        lastRepairDate: null,
        nextPlannedReplacement: due[0] ?? null,
        statusBreakdown: breakdown,
      }
    })
}
