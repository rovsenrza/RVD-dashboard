import {
  DEFAULT_RULES,
  statusOf,
  type Product,
  type ProductLifecycle,
  type StatusRules,
} from '@rvd/contracts'
import type {
  RawCatalogNumber,
  RawComponent,
  RawEquipment,
  RawItem,
  RawRelease,
  RawStatusRecord,
} from '../raw.ts'
import { toComposition } from './catalog.ts'
import {
  byKey,
  cleanText,
  dateOnly,
  displayCode,
  isPlaceholderMachine,
  isRef,
  orNull,
  wholeNumber,
} from './common.ts'

/** The register's «Статус» → the cabinet's lifecycle. An empty status is the record that only created the item. */
const LIFECYCLE: Record<string, ProductLifecycle> = {
  '': 'manufacturing',
  НаОформлении: 'manufacturing',
  Изготавливается: 'manufacturing',
  НаСкладе: 'in_stock',
  Отгружен: 'shipped',
  ВЭксплуатации: 'in_operation',
  Списан: 'written_off',
}

/** Whether the cabinet knows a register status; an unknown one (a repair line, say) is an event, not a stage. */
export const isKnownStatus = (status: string | null | undefined) =>
  Object.hasOwn(LIFECYCLE, cleanText(status))

/** The stage a register status means, or null for one the cabinet does not know. */
export const stageOf = (status: string | null | undefined): ProductLifecycle | null =>
  isKnownStatus(status) ? LIFECYCLE[cleanText(status)] : null

export interface ProductSources {
  items: RawItem[]
  statuses: RawStatusRecord[]
  releases: RawRelease[]
  catalogNumbers: RawCatalogNumber[]
  components: RawComponent[]
  equipment: RawEquipment[]
}

export interface ProductOptions {
  rules?: StatusRules
  today?: Date
}

/**
 * Each item's active status records, oldest first. Records of one moment keep
 * the order their document wrote them in (its line number).
 */
export function statusesByItem(records: RawStatusRecord[]): Map<string, RawStatusRecord[]> {
  const grouped = new Map<string, RawStatusRecord[]>()
  for (const r of records) {
    if (!r.Active) continue
    const list = grouped.get(r.Изделие_Key) ?? []
    list.push(r)
    grouped.set(r.Изделие_Key, list)
  }
  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        a.Period.localeCompare(b.Period) || Number(a.LineNumber || 0) - Number(b.LineNumber || 0),
    )
  }
  return grouped
}

const lastWith = (records: RawStatusRecord[], status: string) =>
  [...records].reverse().find((r) => r.Статус === status)

/**
 * 1С keeps no dates on the item itself: shipment and installation are when the
 * statuses register recorded «Отгружен» and «ВЭксплуатации», the stage is its
 * latest record, the machine is the garage number on the «Выпуск» that
 * recorded the item's status (newest first), health is computed here
 * (docs/1c/mapping.md).
 */
export function toProducts(src: ProductSources, options: ProductOptions = {}): Product[] {
  const rules = options.rules ?? DEFAULT_RULES
  const today = options.today ?? new Date()
  const catalog = byKey(src.catalogNumbers, (c) => c.Ref_Key)
  const components = byKey(src.components, (c) => c.Ref_Key)
  // A hose «on» the «Без привязки» placeholder sits on no machine.
  const equipment = byKey(
    src.equipment.filter((e) => !isPlaceholderMachine(e)),
    (e) => e.Ref_Key,
  )
  const releases = byKey(src.releases, (r) => r.Ref_Key)
  const lifecycles = statusesByItem(src.statuses)

  return src.items
    .filter((item) => !item.DeletionMark)
    .map((item): Product => {
      const history = lifecycles.get(item.Ref_Key) ?? []
      const cat = isRef(item.КаталожныйНомер_Key)
        ? catalog.get(item.КаталожныйНомер_Key)
        : undefined
      const shippedAt = dateOnly(lastWith(history, 'Отгружен')?.Period)
      const installedAt = dateOnly(lastWith(history, 'ВЭксплуатации')?.Period)
      // The stage is the latest status the cabinet knows. A status 1С adds later — the
      // repair line of its new package, say — records an event and must not move the hose.
      const stage = [...history].reverse().find((r) => isKnownStatus(r.Статус))
      const lifecycle = LIFECYCLE[cleanText(stage?.Статус)] ?? 'manufacturing'
      // Every «Выпуск» names a machine, even while the item is still in the warehouse
      // (the order's target); the item sits on it only from shipment on.
      const onMachine = lifecycle === 'shipped' || lifecycle === 'in_operation'
      const garage = onMachine
        ? [...history]
            .reverse()
            .map((r) => releases.get(r.Recorder)?.ГаражныйНомер_Key)
            .find((key) => key !== undefined && isRef(key))
        : undefined
      const machine = garage ? equipment.get(garage) : undefined
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
        manufacturedAt: dateOnly(history[0]?.Period),
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
        // A branch of the client company is one of its 1С clients (not the supplier's Филиал).
        branchId: item.Клиент_Key,
      }
    })
}
