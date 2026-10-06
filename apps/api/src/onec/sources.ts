import { guid, type ODataClient } from './client.ts'
import type { ProductSources } from './adapters/product.ts'
import type { RawNamed, RawOrder, RawStatusRecord } from './raw.ts'

export interface Sources extends ProductSources {
  orders: RawOrder[]
  brands: RawNamed[]
  types: RawNamed[]
}

/** An item's 1С version: a check (Д26) compares it with the cache's. */
export interface ItemVersion {
  Ref_Key: string
  DataVersion: string
  DeletionMark: boolean
}

const REGISTER = 'InformationRegister_СтатусыИзделий_RecordType'
const STATUS_FIELDS = [
  'Period',
  'Recorder',
  'Recorder_Type',
  'LineNumber',
  'Active',
  'Изделие_Key',
  'Статус',
]
const RELEASE_FIELDS = ['Ref_Key', 'Number', 'ГаражныйНомер_Key']
const ORDER_FIELDS = ['Ref_Key', 'Number']
/** Keys per request: `Ref_Key eq guid'…' or …` stays well inside a URL. */
const BATCH = 25

/** The small reference sets — catalogue numbers, components, machines, clients — read whole each time. */
async function fetchReference(client: ODataClient) {
  const [catalogNumbers, components, equipment, clients, brands, types] = await Promise.all([
    client.all('Catalog_КаталожныеНомера'),
    client.all('Catalog_Комплектующие'),
    client.all('Catalog_Техника'),
    client.all('Catalog_Клиенты'),
    client.all('Catalog_Марки'),
    client.all('Catalog_ТипТехники'),
  ])
  return { catalogNumbers, components, equipment, clients, brands, types }
}

/**
 * Reads every set the adapters need. Nothing is joined here: the raw rows go to
 * the adapters as they are, so a wrong assumption shows up in one place.
 */
export async function fetchSources(client: ODataClient): Promise<Sources> {
  const [items, statuses, releases, orders, reference] = await Promise.all([
    client.all('Catalog_Изделия', { pageSize: 500 }),
    client.all(REGISTER, { select: STATUS_FIELDS }),
    client.all('Document_Выпуск', { select: RELEASE_FIELDS }),
    client.all('Document_ЗаказыКлиента', { select: ORDER_FIELDS }),
    fetchReference(client),
  ])
  return { items, statuses, releases, orders, ...reference } as Sources
}

/** Rows whose `field` is one of `keys`, a batch of keys per request. */
async function byKeys<T>(
  client: ODataClient,
  entity: string,
  field: string,
  keys: string[],
  select?: string[],
): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < keys.length; i += BATCH) {
    const filter = keys
      .slice(i, i + BATCH)
      .map((k) => `${field} eq ${guid(k)}`)
      .join(' or ')
    out.push(...(await client.all<T>(entity, { filter, select })))
  }
  return out
}

/** Every item's version, cheap enough to read on each check (4 269 items: under a second). */
export const fetchVersions = (client: ODataClient) =>
  client.all<ItemVersion>('Catalog_Изделия', { select: ['Ref_Key', 'DataVersion', 'DeletionMark'] })

/** The register lines recorded from `since` (1С's own time, `YYYY-MM-DDTHH:mm:ss`) on. */
export const fetchRegisterSince = (client: ODataClient, since: string) =>
  client.all<Pick<RawStatusRecord, 'Period' | 'Изделие_Key'>>(REGISTER, {
    filter: `Period ge datetime'${since}'`,
    select: ['Period', 'Изделие_Key'],
  })

/**
 * The same sets as `fetchSources`, for the given items only: the items, all
 * their register lines and the documents those name; the reference sets whole.
 */
export async function fetchSourcesFor(client: ODataClient, ids: string[]): Promise<Sources> {
  const [items, statuses, reference] = await Promise.all([
    byKeys<ProductSources['items'][number]>(client, 'Catalog_Изделия', 'Ref_Key', ids),
    byKeys<RawStatusRecord>(client, REGISTER, 'Изделие_Key', ids, STATUS_FIELDS),
    fetchReference(client),
  ])
  const recorders = (type: string) => [
    ...new Set(statuses.filter((s) => s.Recorder_Type.endsWith(type)).map((s) => s.Recorder)),
  ]
  const [releases, orders] = await Promise.all([
    byKeys<ProductSources['releases'][number]>(
      client,
      'Document_Выпуск',
      'Ref_Key',
      recorders('Document_Выпуск'),
      RELEASE_FIELDS,
    ),
    byKeys<RawOrder>(
      client,
      'Document_ЗаказыКлиента',
      'Ref_Key',
      recorders('Document_ЗаказыКлиента'),
      ORDER_FIELDS,
    ),
  ])
  return { items, statuses, releases, orders, ...reference } as Sources
}
