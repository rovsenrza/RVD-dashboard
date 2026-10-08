/** Rows as 1С publishes them: only the fields the adapters read (see docs/1c/odata-inventory.md). */

export const ZERO_GUID = '00000000-0000-0000-0000-000000000000'

export interface RawIndicatorLine {
  LineNumber: string
  Комплектующие_Key: string
  ЗначениеПоказателя: number
}

export interface RawItem {
  Ref_Key: string
  /** Changes whenever the item is written in 1С; a check (Д26) compares it */
  DataVersion?: string
  DeletionMark: boolean
  Code: string
  Description: string
  КаталожныйНомер_Key: string
  ЗаменяемоеИзделие_Key: string
  /** Days, as text: "365", "0" */
  СрокПолезногоИспользования: string
  СрокГарантии: string
  Клиент_Key: string
  /**
   * The machine the item belongs to (`Catalog_Техника`); «Без привязки к технике» when none.
   * The 1С developer (2026-10-08): the item and the register are the truth — not «Выпуск»,
   * whose machine and client have disagreed with the item's.
   */
  Owner_Key: string
  Диаметр: number
  КоличествоОплетокНавивок: string
  НоменклатурныйНомер: string
  Комплектующие: RawIndicatorLine[]
}

/**
 * One record of the statuses register (`InformationRegister_СтатусыИзделий`):
 * the item's lifecycle as 1С itself keeps it. The 1С developer's rule
 * (2026-10-03): build the lifecycle from here, never from the documents —
 * «Выпуск» changed shape over the years, «Заказ» used to set statuses too, and
 * a document's header may still say «НаСкладе» while it has recorded a later
 * «Отгружен».
 */
export interface RawStatusRecord {
  /** When the status took effect */
  Period: string
  /** The document that recorded it */
  Recorder: string
  /** `StandardODATA.Document_Выпуск` or `StandardODATA.Document_ЗаказыКлиента` */
  Recorder_Type: string
  /** Order within one document's records, as text: "1", "2" */
  LineNumber: string
  Active: boolean
  Изделие_Key: string
  Статус: string
}

/** «Выпуск», read only for its number, by which the history names the document that recorded a status. */
export interface RawRelease {
  Ref_Key: string
  /** Zero-padded: "000000123" */
  Number: string
}

/** «Заказ клиента», read for its number: before «Выпуск» took over, orders set statuses too. */
export interface RawOrder {
  Ref_Key: string
  /** "СВЦБ-002157" */
  Number: string
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
