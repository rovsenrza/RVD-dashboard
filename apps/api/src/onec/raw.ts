/** Rows as 1С publishes them: only the fields the adapters read (see docs/1c/odata-inventory.md). */

export const ZERO_GUID = '00000000-0000-0000-0000-000000000000'

export interface RawIndicatorLine {
  LineNumber: string
  Комплектующие_Key: string
  ЗначениеПоказателя: number
}

export interface RawItem {
  Ref_Key: string
  DeletionMark: boolean
  Code: string
  Description: string
  КаталожныйНомер_Key: string
  ЗаменяемоеИзделие_Key: string
  /** Days, as text: "365", "0" */
  СрокПолезногоИспользования: string
  СрокГарантии: string
  Клиент_Key: string
  Диаметр: number
  КоличествоОплетокНавивок: string
  НоменклатурныйНомер: string
  Комплектующие: RawIndicatorLine[]
}

/** «Выпуск»: one document per status change of one item. */
export interface RawRelease {
  Ref_Key: string
  Number: string
  Date: string
  Posted: boolean
  DeletionMark: boolean
  Изделие_Key: string
  ГаражныйНомер_Key: string
  Клиент_Key: string
  Филиал_Key: string
  Статус: string
}

export interface RawCatalogNumber {
  Ref_Key: string
  DeletionMark: boolean
  Code: string
  Description: string
  СрокПолезногоИспользования: string
  СрокГарантии: string
  Диаметр: number
  КоличествоОплетокНавивок: string
  Комплектующие: RawIndicatorLine[]
}

export interface RawComponent {
  Ref_Key: string
  Code: string
  Description: string
  /** Длина | Количество */
  ТипПоказателя: string
  /** Рукава | Фитинги | Муфты | Защита | Сростки | Прочее */
  ТипыКомплектующих: string
}

export interface RawEquipment {
  Ref_Key: string
  DeletionMark: boolean
  Code: string
  Description: string
  /** The owning customer */
  Owner_Key: string
  Марка_Key: string
  Модель_Key: string
  Тип_Key: string
  ГаражныйНомер: string
  ИнвентарныйНомер: string
}

export interface RawNamed {
  Ref_Key: string
  Description: string
}

export interface RawClient extends RawNamed {
  Филиал_Key: string
}
