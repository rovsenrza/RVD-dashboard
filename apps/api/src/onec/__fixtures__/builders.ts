import {
  ZERO_GUID,
  type RawCatalogNumber,
  type RawComponent,
  type RawEquipment,
  type RawItem,
  type RawRelease,
  type RawStatusRecord,
} from '../raw.ts'

/** Synthetic rows shaped like the live 1С ones (no customer data). */

export const item = (over: Partial<RawItem> = {}): RawItem => ({
  Ref_Key: 'item-1',
  DeletionMark: false,
  Code: '000003844           ',
  Description: '2SC ду10 рукав Rock Arctic L 1 050',
  КаталожныйНомер_Key: ZERO_GUID,
  ЗаменяемоеИзделие_Key: ZERO_GUID,
  СрокПолезногоИспользования: '365',
  СрокГарантии: '180',
  Клиент_Key: 'client-1',
  Owner_Key: ZERO_GUID,
  Диаметр: 10,
  КоличествоОплетокНавивок: '2  ',
  НоменклатурныйНомер: '',
  Комплектующие: [],
  ...over,
})

/** One record of the statuses register, written by «Выпуск» `doc-1` unless told otherwise. */
export const statusRecord = (over: Partial<RawStatusRecord> = {}): RawStatusRecord => ({
  Period: '2026-01-10T09:00:00',
  Recorder: 'doc-1',
  Recorder_Type: 'StandardODATA.Document_Выпуск',
  LineNumber: '1',
  Active: true,
  Изделие_Key: 'item-1',
  Статус: 'НаСкладе',
  ...over,
})

/** «Выпуск» as the adapters read it: its number, and the machine and client it repeats. */
export const release = (over: Partial<RawRelease> = {}): RawRelease => ({
  Ref_Key: 'doc-1',
  Number: '000000001',
  ГаражныйНомер_Key: ZERO_GUID,
  Клиент_Key: ZERO_GUID,
  ...over,
})

export const catalogNumber = (over: Partial<RawCatalogNumber> = {}): RawCatalogNumber => ({
  Ref_Key: 'cat-1',
  DeletionMark: false,
  Code: '000000175',
  Description: '02753-00613',
  СрокПолезногоИспользования: '730',
  СрокГарантии: '365',
  Диаметр: 20,
  КоличествоОплетокНавивок: '4  ',
  Комплектующие: [
    { LineNumber: '2', Комплектующие_Key: 'comp-fitting', ЗначениеПоказателя: 2 },
    { LineNumber: '1', Комплектующие_Key: 'comp-hose', ЗначениеПоказателя: 1.35 },
  ],
  ...over,
})

export const components: RawComponent[] = [
  {
    Ref_Key: 'comp-hose',
    Code: '1',
    Description: ' 4SH ду25 рукав',
    ТипПоказателя: 'Длина',
    ТипыКомплектующих: 'Рукава',
  },
  {
    Ref_Key: 'comp-fitting',
    Code: '2',
    Description: '16x1.5 фитинг',
    ТипПоказателя: 'Количество',
    ТипыКомплектующих: 'Фитинги',
  },
]

export const equipment = (over: Partial<RawEquipment> = {}): RawEquipment => ({
  Ref_Key: 'eq-1',
  DeletionMark: false,
  Code: '000000079',
  Description: ' FAW  р414вв154',
  Owner_Key: 'client-1',
  Марка_Key: 'brand-1',
  Модель_Key: ZERO_GUID,
  Тип_Key: 'type-1',
  ГаражныйНомер: 'р414вв154',
  ИнвентарныйНомер: '',
  ...over,
})
