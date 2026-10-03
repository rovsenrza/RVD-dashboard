import type { ODataClient } from './client.ts'
import type { ProductSources } from './adapters/product.ts'
import type { RawNamed } from './raw.ts'

export interface Sources extends ProductSources {
  brands: RawNamed[]
  types: RawNamed[]
}

/**
 * Reads every set the adapters need. Nothing is joined here: the raw rows go to
 * the adapters as they are, so a wrong assumption shows up in one place.
 */
export async function fetchSources(client: ODataClient): Promise<Sources> {
  const [items, statuses, releases, catalogNumbers, components, equipment, clients, brands, types] =
    await Promise.all([
      client.all('Catalog_Изделия', { pageSize: 500 }),
      client.all('InformationRegister_СтатусыИзделий_RecordType', {
        select: [
          'Period',
          'Recorder',
          'Recorder_Type',
          'LineNumber',
          'Active',
          'Изделие_Key',
          'Статус',
        ],
      }),
      client.all('Document_Выпуск', { select: ['Ref_Key', 'ГаражныйНомер_Key'] }),
      client.all('Catalog_КаталожныеНомера'),
      client.all('Catalog_Комплектующие'),
      client.all('Catalog_Техника'),
      client.all('Catalog_Клиенты'),
      client.all('Catalog_Марки'),
      client.all('Catalog_ТипТехники'),
    ])
  return {
    items,
    statuses,
    releases,
    catalogNumbers,
    components,
    equipment,
    clients,
    brands,
    types,
  } as Sources
}
