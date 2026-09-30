# 1С OData: инвентарь опубликованных объектов (Д1)

Снято автоматически с `$metadata` и живых данных 2026-09-30 (`…/rvd/odata/standard.odata`). Сырые `$metadata` и выгрузки по 20 записей лежат в `docs/customer/` (не в репозитории).

| Объект                                           |     Записей |
| ------------------------------------------------ | ----------: |
| `InformationRegister_История`                    |        8594 |
| `InformationRegister_История_RecordType`         |        8594 |
| `InformationRegister_СтатусыИзделий`             |        8601 |
| `InformationRegister_СтатусыИзделий_RecordType`  |        9529 |
| `Catalog_ВидыКонтактнойИнформации`               |           3 |
| `Catalog_ВидыКонтактнойИнформации_Представления` |           0 |
| `Catalog_Производители`                          |           0 |
| `Catalog_Изделия`                                |        4076 |
| `Catalog_Изделия_Комплектующие`                  |       14089 |
| `Catalog_КаталожныеНомера`                       |         223 |
| `Catalog_КаталожныеНомера_Комплектующие`         |         848 |
| `Document_ЗаказыКлиента`                         |        1666 |
| `Document_ЗаказыКлиента_Изделия`                 |        3464 |
| `Catalog_Клиенты`                                |         312 |
| `Catalog_Филиалы`                                |           6 |
| `Catalog_Комплектующие`                          |        1437 |
| `Catalog_Марки`                                  |          81 |
| `Catalog_ТипТехники`                             |          32 |
| `Catalog_Модели`                                 | нет доступа |
| `Catalog_Пользователи`                           |          32 |
| `Catalog_Пользователи_ДополнительныеРеквизиты`   |           0 |
| `Catalog_Пользователи_КонтактнаяИнформация`      |           0 |
| `Catalog_Техника`                                |         669 |
| `Document_Выпуск`                                |        8595 |
| `Document_ВыпускЗаСмену`                         | нет доступа |
| `Document_ВыпускЗаСмену_Изделия`                 | нет доступа |

## `InformationRegister_История`

Ключ: Recorder_Key · записей: 8594

| Поле         | Тип                                             | Nullable |
| ------------ | ----------------------------------------------- | -------- |
| Recorder_Key | Guid                                            | нет      |
| RecordSet    | Collection(InformationRegister_История_RowType) | нет      |

## `InformationRegister_История_RecordType`

Ключ: Recorder_Key, Period, Рукав_Key · записей: 8594

| Поле         | Тип      | Nullable |
| ------------ | -------- | -------- |
| Recorder_Key | Guid     | нет      |
| Period       | DateTime | нет      |
| LineNumber   | Int64    | да       |
| Active       | Boolean  | да       |
| Рукав_Key    | Guid     | нет      |

Навигация: Recorder, Рукав

## `InformationRegister_СтатусыИзделий`

Ключ: Recorder, Recorder_Type · записей: 8601

| Поле          | Тип                                                    | Nullable |
| ------------- | ------------------------------------------------------ | -------- |
| Recorder      | String                                                 | нет      |
| RecordSet     | Collection(InformationRegister_СтатусыИзделий_RowType) | нет      |
| Recorder_Type | String                                                 | нет      |

## `InformationRegister_СтатусыИзделий_RecordType`

Ключ: Recorder, Period, Изделие_Key, Recorder_Type · записей: 9529

| Поле          | Тип      | Nullable |
| ------------- | -------- | -------- |
| Recorder      | String   | нет      |
| Period        | DateTime | нет      |
| LineNumber    | Int64    | да       |
| Active        | Boolean  | да       |
| Изделие_Key   | Guid     | нет      |
| Статус        | String   | да       |
| Recorder_Type | String   | нет      |

Навигация: Изделие

## `Catalog_ВидыКонтактнойИнформации`

Ключ: Ref_Key · записей: 3

| Поле                                       | Тип                                                                | Nullable |
| ------------------------------------------ | ------------------------------------------------------------------ | -------- |
| Ref_Key                                    | Guid                                                               | нет      |
| Description                                | String                                                             | да       |
| Parent_Key                                 | Guid                                                               | да       |
| IsFolder                                   | Boolean                                                            | да       |
| DeletionMark                               | Boolean                                                            | да       |
| ВводитьНомерПоМаске                        | Boolean                                                            | да       |
| ВключатьСтрануВПредставление               | Boolean                                                            | да       |
| ВидПоляДругое                              | String                                                             | да       |
| ВидРедактирования                          | String                                                             | да       |
| ЗапретитьРедактированиеПользователем       | Boolean                                                            | да       |
| ИдентификаторДляФормул                     | String                                                             | да       |
| ИмяГруппы                                  | String                                                             | да       |
| ИмяПредопределенногоВида                   | String                                                             | да       |
| Используется                               | Boolean                                                            | да       |
| ИсправлятьУстаревшиеАдреса                 | Boolean                                                            | да       |
| МаскаНомераТелефона                        | String                                                             | да       |
| МеждународныйФорматАдреса                  | Boolean                                                            | да       |
| МожноИзменятьСпособРедактирования          | Boolean                                                            | да       |
| ОбязательноеЗаполнение                     | Boolean                                                            | да       |
| ПроверятьКорректность                      | Boolean                                                            | да       |
| УдалитьПроверятьПоФИАС                     | Boolean                                                            | да       |
| РазрешитьВводНесколькихЗначений            | Boolean                                                            | да       |
| РеквизитДопУпорядочивания                  | Int64                                                              | да       |
| СкрыватьНеактуальныеАдреса                 | Boolean                                                            | да       |
| ТелефонСДобавочнымНомером                  | Boolean                                                            | да       |
| Тип                                        | String                                                             | да       |
| ТолькоНациональныйАдрес                    | Boolean                                                            | да       |
| УдалитьРедактированиеТолькоВДиалоге        | Boolean                                                            | да       |
| УказыватьОКТМО                             | Boolean                                                            | да       |
| ХранитьИсториюИзменений                    | Boolean                                                            | да       |
| ОтображатьВсегда                           | Boolean                                                            | да       |
| НаименованиеЯзык1                          | String                                                             | да       |
| НаименованиеЯзык2                          | String                                                             | да       |
| ОтредактированныеПредопределенныеРеквизиты | String                                                             | да       |
| Представления                              | Collection(Catalog_ВидыКонтактнойИнформации_Представления_RowType) | да       |

Навигация: Parent

## `Catalog_ВидыКонтактнойИнформации_Представления`

Ключ: Ref_Key, LineNumber · записей: 0

| Поле         | Тип    | Nullable |
| ------------ | ------ | -------- |
| Ref_Key      | Guid   | нет      |
| LineNumber   | Int64  | нет      |
| КодЯзыка     | String | да       |
| Наименование | String | да       |

## `Catalog_Производители`

Ключ: Ref_Key · записей: 0

| Поле         | Тип     | Nullable |
| ------------ | ------- | -------- |
| Ref_Key      | Guid    | нет      |
| Description  | String  | да       |
| Code         | String  | да       |
| DeletionMark | Boolean | да       |

## `Catalog_Изделия`

Ключ: Ref_Key · записей: 4076

| Поле                       | Тип                                               | Nullable |
| -------------------------- | ------------------------------------------------- | -------- |
| Ref_Key                    | Guid                                              | нет      |
| Description                | String                                            | да       |
| Code                       | String                                            | да       |
| Owner_Key                  | Guid                                              | да       |
| DeletionMark               | Boolean                                           | да       |
| КаталожныйНомер_Key        | Guid                                              | да       |
| ЗаменяемоеИзделие_Key      | Guid                                              | да       |
| СрокПолезногоИспользования | Int64                                             | да       |
| СрокГарантии               | Int64                                             | да       |
| Клиент_Key                 | Guid                                              | да       |
| Диаметр                    | Int16                                             | да       |
| КоличествоОплетокНавивок   | String                                            | да       |
| Автор_Key                  | Guid                                              | да       |
| НоменклатурныйНомер        | String                                            | да       |
| Комплектующие              | Collection(Catalog_Изделия_Комплектующие_RowType) | да       |

Навигация: Owner, КаталожныйНомер, ЗаменяемоеИзделие, Клиент, Автор

## `Catalog_Изделия_Комплектующие`

Ключ: Ref_Key, LineNumber · записей: 14089

| Поле               | Тип    | Nullable |
| ------------------ | ------ | -------- |
| Ref_Key            | Guid   | нет      |
| LineNumber         | Int64  | нет      |
| Комплектующие_Key  | Guid   | да       |
| ЗначениеПоказателя | Double | да       |

Навигация: Комплектующие

## `Catalog_КаталожныеНомера`

Ключ: Ref_Key · записей: 223

| Поле                       | Тип                                                        | Nullable |
| -------------------------- | ---------------------------------------------------------- | -------- |
| Ref_Key                    | Guid                                                       | нет      |
| Description                | String                                                     | да       |
| Code                       | String                                                     | да       |
| DeletionMark               | Boolean                                                    | да       |
| СрокПолезногоИспользования | Int64                                                      | да       |
| СрокГарантии               | Int64                                                      | да       |
| Диаметр                    | Int16                                                      | да       |
| КоличествоОплетокНавивок   | String                                                     | да       |
| Комплектующие              | Collection(Catalog_КаталожныеНомера_Комплектующие_RowType) | да       |

## `Catalog_КаталожныеНомера_Комплектующие`

Ключ: Ref_Key, LineNumber · записей: 848

| Поле               | Тип    | Nullable |
| ------------------ | ------ | -------- |
| Ref_Key            | Guid   | нет      |
| LineNumber         | Int64  | нет      |
| Комплектующие_Key  | Guid   | да       |
| ЗначениеПоказателя | Double | да       |

Навигация: Комплектующие

## `Document_ЗаказыКлиента`

Ключ: Ref_Key · записей: 1666

| Поле               | Тип                                                | Nullable |
| ------------------ | -------------------------------------------------- | -------- |
| Ref_Key            | Guid                                               | нет      |
| Number             | String                                             | да       |
| Date               | DateTime                                           | да       |
| DeletionMark       | Boolean                                            | да       |
| Posted             | Boolean                                            | да       |
| Клиент_Key         | Guid                                               | да       |
| Комментарий        | String                                             | да       |
| СтатусЗаказа       | String                                             | да       |
| Автор_Key          | Guid                                               | да       |
| СозданВРВД         | Boolean                                            | да       |
| Филиал_Key         | Guid                                               | да       |
| Отгрузка           | String                                             | да       |
| Импортирован       | Boolean                                            | да       |
| ДатаЗагрузки       | DateTime                                           | да       |
| СтатусОбменаЗаказа | String                                             | да       |
| ДетальныйСтатусВУТ | String                                             | да       |
| Изделия            | Collection(Document_ЗаказыКлиента_Изделия_RowType) | да       |

Навигация: Клиент, Автор, Филиал

## `Document_ЗаказыКлиента_Изделия`

Ключ: Ref_Key, LineNumber · записей: 3464

| Поле                | Тип     | Nullable |
| ------------------- | ------- | -------- |
| Ref_Key             | Guid    | нет      |
| LineNumber          | Int64   | нет      |
| Техника_Key         | Guid    | да       |
| Изделие_Key         | Guid    | да       |
| КаталожныйНомер_Key | Guid    | да       |
| Коммментарий        | String  | да       |
| СтатусИзделия       | String  | да       |
| Отметка             | Boolean | да       |
| СтатусОтгрузки      | String  | да       |
| СтатусОбменаСборки  | String  | да       |

Навигация: Техника, Изделие, КаталожныйНомер

## `Catalog_Клиенты`

Ключ: Ref_Key · записей: 312

| Поле         | Тип     | Nullable |
| ------------ | ------- | -------- |
| Ref_Key      | Guid    | нет      |
| Description  | String  | да       |
| Code         | String  | да       |
| DeletionMark | Boolean | да       |
| ЮрФизЛицо    | String  | да       |
| ИНН          | String  | да       |
| Филиал_Key   | Guid    | да       |

Навигация: Филиал

## `Catalog_Филиалы`

Ключ: Ref_Key · записей: 6

| Поле         | Тип     | Nullable |
| ------------ | ------- | -------- |
| Ref_Key      | Guid    | нет      |
| Description  | String  | да       |
| Code         | String  | да       |
| DeletionMark | Boolean | да       |
| Адрес        | String  | да       |

## `Catalog_Комплектующие`

Ключ: Ref_Key · записей: 1437

| Поле              | Тип     | Nullable |
| ----------------- | ------- | -------- |
| Ref_Key           | Guid    | нет      |
| Description       | String  | да       |
| Code              | String  | да       |
| DeletionMark      | Boolean | да       |
| ТипПоказателя     | String  | да       |
| Производитель_Key | Guid    | да       |
| ТипыКомплектующих | String  | да       |

Навигация: Производитель

## `Catalog_Марки`

Ключ: Ref_Key · записей: 81

| Поле         | Тип     | Nullable |
| ------------ | ------- | -------- |
| Ref_Key      | Guid    | нет      |
| Description  | String  | да       |
| Code         | String  | да       |
| DeletionMark | Boolean | да       |

## `Catalog_ТипТехники`

Ключ: Ref_Key · записей: 32

| Поле         | Тип     | Nullable |
| ------------ | ------- | -------- |
| Ref_Key      | Guid    | нет      |
| Description  | String  | да       |
| Code         | String  | да       |
| DeletionMark | Boolean | да       |

## `Catalog_Модели`

Ключ: Ref_Key · записей: нет доступа

| Поле           | Тип     | Nullable |
| -------------- | ------- | -------- |
| Ref_Key        | Guid    | нет      |
| Description    | String  | да       |
| Code           | String  | да       |
| Owner_Key      | Guid    | да       |
| DeletionMark   | Boolean | да       |
| ТипТехники_Key | Guid    | да       |

Навигация: Owner, ТипТехники

## `Catalog_Пользователи`

Ключ: Ref_Key · записей: 32

| Поле                                     | Тип                                                              | Nullable |
| ---------------------------------------- | ---------------------------------------------------------------- | -------- |
| Ref_Key                                  | Guid                                                             | нет      |
| Description                              | String                                                           | да       |
| DeletionMark                             | Boolean                                                          | да       |
| Недействителен                           | Boolean                                                          | да       |
| Подразделение_Key                        | Guid                                                             | да       |
| ФизическоеЛицо                           | String                                                           | да       |
| Комментарий                              | String                                                           | да       |
| Служебный                                | Boolean                                                          | да       |
| Подготовлен                              | Boolean                                                          | да       |
| ИдентификаторПользователяИБ              | Guid                                                             | да       |
| ИдентификаторПользователяСервиса         | Guid                                                             | да       |
| УдалитьСвойстваПользователяИБ_Base64Data | Binary                                                           | да       |
| Фотография_Base64Data                    | Binary                                                           | да       |
| РольВСистеме                             | String                                                           | да       |
| Клиент_Key                               | Guid                                                             | да       |
| ДополнительныеРеквизиты                  | Collection(Catalog_Пользователи_ДополнительныеРеквизиты_RowType) | да       |
| КонтактнаяИнформация                     | Collection(Catalog_Пользователи_КонтактнаяИнформация_RowType)    | да       |
| УдалитьСвойстваПользователяИБ_Type       | String                                                           | да       |
| Фотография_Type                          | String                                                           | да       |
| УдалитьСвойстваПользователяИБ            | Stream                                                           | да       |
| Фотография                               | Stream                                                           | да       |

Навигация: Подразделение, Клиент

## `Catalog_Пользователи_ДополнительныеРеквизиты`

Ключ: Ref_Key, LineNumber · записей: 0

| Поле            | Тип    | Nullable |
| --------------- | ------ | -------- |
| Ref_Key         | Guid   | нет      |
| LineNumber      | Int64  | нет      |
| Свойство_Key    | Guid   | да       |
| Значение        | String | да       |
| ТекстоваяСтрока | String | да       |
| Значение_Type   | String | да       |

## `Catalog_Пользователи_КонтактнаяИнформация`

Ключ: Ref_Key, LineNumber · записей: 0

| Поле                  | Тип    | Nullable |
| --------------------- | ------ | -------- |
| Ref_Key               | Guid   | нет      |
| LineNumber            | Int64  | нет      |
| Тип                   | String | да       |
| Вид_Key               | Guid   | да       |
| Представление         | String | да       |
| ЗначенияПолей         | String | да       |
| Страна                | String | да       |
| Регион                | String | да       |
| Город                 | String | да       |
| АдресЭП               | String | да       |
| ДоменноеИмяСервера    | String | да       |
| НомерТелефона         | String | да       |
| НомерТелефонаБезКодов | String | да       |
| ВидДляСписка_Key      | Guid   | да       |
| Значение              | String | да       |

Навигация: Вид, ВидДляСписка

## `Catalog_Техника`

Ключ: Ref_Key · записей: 669

| Поле             | Тип     | Nullable |
| ---------------- | ------- | -------- |
| Ref_Key          | Guid    | нет      |
| Description      | String  | да       |
| Code             | String  | да       |
| Owner_Key        | Guid    | да       |
| DeletionMark     | Boolean | да       |
| Марка_Key        | Guid    | да       |
| Модель_Key       | Guid    | да       |
| Тип_Key          | Guid    | да       |
| ГаражныйНомер    | String  | да       |
| ИнвентарныйНомер | String  | да       |

Навигация: Owner, Марка, Модель, Тип

## `Document_Выпуск`

Ключ: Ref_Key · записей: 8595

| Поле              | Тип      | Nullable |
| ----------------- | -------- | -------- |
| Ref_Key           | Guid     | нет      |
| Number            | String   | да       |
| Date              | DateTime | да       |
| DeletionMark      | Boolean  | да       |
| Posted            | Boolean  | да       |
| ГаражныйНомер_Key | Guid     | да       |
| Изделие_Key       | Guid     | да       |
| Клиент_Key        | Guid     | да       |
| Филиал_Key        | Guid     | да       |
| Статус            | String   | да       |
| Автор_Key         | Guid     | да       |
| Основание_Key     | Guid     | да       |

Навигация: ГаражныйНомер, Изделие, Клиент, Филиал, Автор, Основание

## `Document_ВыпускЗаСмену`

Ключ: Ref_Key · записей: нет доступа

| Поле         | Тип                                                | Nullable |
| ------------ | -------------------------------------------------- | -------- |
| Ref_Key      | Guid                                               | нет      |
| Number       | String                                             | да       |
| Date         | DateTime                                           | да       |
| DeletionMark | Boolean                                            | да       |
| Posted       | Boolean                                            | да       |
| Филиал_Key   | Guid                                               | да       |
| Комментарий  | String                                             | да       |
| Изделия      | Collection(Document_ВыпускЗаСмену_Изделия_RowType) | да       |

Навигация: Филиал

## `Document_ВыпускЗаСмену_Изделия`

Ключ: Ref_Key, LineNumber · записей: нет доступа

| Поле        | Тип   | Nullable |
| ----------- | ----- | -------- |
| Ref_Key     | Guid  | нет      |
| LineNumber  | Int64 | нет      |
| Изделие_Key | Guid  | да       |
| Заявка_Key  | Guid  | да       |

Навигация: Изделие, Заявка
