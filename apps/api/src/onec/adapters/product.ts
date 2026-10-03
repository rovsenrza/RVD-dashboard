import {
  DEFAULT_RULES,
  statusOf,
  type Product,
  type ProductLifecycle,
  type StatusRules,
} from '@rvd/contracts'
import type {
  RawCatalogNumber,
  RawClient,
  RawComponent,
  RawEquipment,
  RawItem,
  RawRelease,
} from '../raw.ts'
import { toComposition } from './catalog.ts'
import { byKey, cleanText, dateOnly, displayCode, isRef, orNull, wholeNumber } from './common.ts'

/** «Выпуск».Статус → the cabinet's lifecycle. An empty status is a document that only created the item. */
const LIFECYCLE: Record<string, ProductLifecycle> = {
  '': 'manufacturing',
  НаОформлении: 'manufacturing',
  Изготавливается: 'manufacturing',
  НаСкладе: 'in_stock',
  Отгружен: 'shipped',
  ВЭксплуатации: 'in_operation',
  Списан: 'written_off',
}

export interface ProductSources {
  items: RawItem[]
  releases: RawRelease[]
  catalogNumbers: RawCatalogNumber[]
  components: RawComponent[]
  equipment: RawEquipment[]
  clients: RawClient[]
}

export interface ProductOptions {
  rules?: StatusRules
  today?: Date
}

/** Posted release documents of each item, oldest first; equal dates fall back to the document number. */
function releasesByItem(releases: RawRelease[]): Map<string, RawRelease[]> {
  const grouped = new Map<string, RawRelease[]>()
  for (const r of releases) {
    if (!r.Posted || r.DeletionMark) continue
    const list = grouped.get(r.Изделие_Key) ?? []
    list.push(r)
    grouped.set(r.Изделие_Key, list)
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.Date.localeCompare(b.Date) || a.Number.localeCompare(b.Number))
  }
  return grouped
}

const lastWith = (docs: RawRelease[], status: string) =>
  [...docs].reverse().find((d) => d.Статус === status)

/**
 * 1С keeps no dates on the item itself: shipment and installation are the dates
 * of its «Отгружен» and «ВЭксплуатации» release documents, the machine is the
 * latest document's garage number, health is computed here (docs/1c/mapping.md).
 */
export function toProducts(src: ProductSources, options: ProductOptions = {}): Product[] {
  const rules = options.rules ?? DEFAULT_RULES
  const today = options.today ?? new Date()
  const catalog = byKey(src.catalogNumbers, (c) => c.Ref_Key)
  const components = byKey(src.components, (c) => c.Ref_Key)
  const equipment = byKey(src.equipment, (e) => e.Ref_Key)
  const clients = byKey(src.clients, (c) => c.Ref_Key)
  const docs = releasesByItem(src.releases)

  return src.items
    .filter((item) => !item.DeletionMark)
    .map((item): Product => {
      const history = docs.get(item.Ref_Key) ?? []
      const latest = history.at(-1)
      const cat = isRef(item.КаталожныйНомер_Key)
        ? catalog.get(item.КаталожныйНомер_Key)
        : undefined
      const shippedAt = dateOnly(lastWith(history, 'Отгружен')?.Date)
      const installedAt = dateOnly(lastWith(history, 'ВЭксплуатации')?.Date)
      const lifecycle = LIFECYCLE[cleanText(latest?.Статус)] ?? 'in_stock'
      // Every document names a machine, even while the item is still in the warehouse
      // (the order's target); the item sits on it only from shipment on.
      const onMachine = lifecycle === 'shipped' || lifecycle === 'in_operation'
      const machine =
        onMachine && latest && isRef(latest.ГаражныйНомер_Key)
          ? equipment.get(latest.ГаражныйНомер_Key)
          : undefined
      const lines = item.Комплектующие?.length ? item.Комплектующие : (cat?.Комплектующие ?? [])

      const serviceLifeDays =
        wholeNumber(item.СрокПолезногоИспользования) || wholeNumber(cat?.СрокПолезногоИспользования)
      const warrantyDays = wholeNumber(item.СрокГарантии)
      const type = cleanText(item.Description) || cleanText(cat?.Description)

      return {
        id: item.Ref_Key,
        serialNumber: displayCode(item.Code),
        clientNumber: null,
        catalogNumberId: cat?.Ref_Key ?? null,
        catalogNumber: cat ? orNull(cat.Description) : null,
        nomenclatureNumber: orNull(item.НоменклатурныйНомер),
        type,
        manufacturer: '',
        specs: '',
        diameter: item.Диаметр || cat?.Диаметр || 0,
        braidCount:
          wholeNumber(item.КоличествоОплетокНавивок) || wholeNumber(cat?.КоличествоОплетокНавивок),
        composition: toComposition(lines, components),
        manufacturedAt: dateOnly(history[0]?.Date),
        shippedAt,
        installedAt,
        warrantyDays,
        serviceLifeDays,
        // No service life on record (0 in 1С) gives no planned date to measure against.
        status:
          serviceLifeDays > 0
            ? statusOf({ installedAt, shippedAt, serviceLifeDays, warrantyDays }, rules, today)
            : 'no_warranty',
        lifecycle,
        replacedProductId: isRef(item.ЗаменяемоеИзделие_Key) ? item.ЗаменяемоеИзделие_Key : null,
        equipmentId: machine?.Ref_Key ?? null,
        installPlace: null,
        branchId: clients.get(item.Клиент_Key)?.Филиал_Key ?? '',
      }
    })
}
