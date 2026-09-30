import type { CatalogNumber, CompositionLine, ComponentItem, ComponentType } from '@rvd/contracts'
import type { RawCatalogNumber, RawComponent, RawIndicatorLine } from '../raw.ts'
import { cleanText, orNull, wholeNumber } from './common.ts'

const COMPONENT_TYPE: Record<string, ComponentType> = {
  Рукава: 'hose',
  Фитинги: 'fitting',
  Муфты: 'coupling',
  Сростки: 'splice',
  Защита: 'protection',
}

export function toComponent(raw: RawComponent): ComponentItem {
  return {
    id: raw.Ref_Key,
    code: cleanText(raw.Code),
    name: cleanText(raw.Description),
    spec: orNull(raw.ТипПоказателя),
    manufacturer: null,
    type: COMPONENT_TYPE[cleanText(raw.ТипыКомплектующих)] ?? 'other',
  }
}

/** Composition lines in table order; a line whose component is unknown keeps its key as the name. */
export function toComposition(
  lines: RawIndicatorLine[],
  components: Map<string, RawComponent>,
): CompositionLine[] {
  return [...lines]
    .sort((a, b) => Number(a.LineNumber) - Number(b.LineNumber))
    .map((line) => ({
      componentId: line.Комплектующие_Key,
      name:
        cleanText(components.get(line.Комплектующие_Key)?.Description) || line.Комплектующие_Key,
      quantity: line.ЗначениеПоказателя,
    }))
}

export function toCatalogNumber(
  raw: RawCatalogNumber,
  components: Map<string, RawComponent>,
): CatalogNumber {
  return {
    id: raw.Ref_Key,
    code: cleanText(raw.Code),
    name: cleanText(raw.Description),
    serviceLifeDays: wholeNumber(raw.СрокПолезногоИспользования),
    warrantyDays: wholeNumber(raw.СрокГарантии),
    diameter: raw.Диаметр,
    braidCount: wholeNumber(raw.КоличествоОплетокНавивок),
    composition: toComposition(raw.Комплектующие ?? [], components),
  }
}
