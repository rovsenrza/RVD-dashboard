import { guid, type ODataClient } from './client.ts'
import type { ProductSources } from './adapters/product.ts'
import type { RawNamed, RawOrder, RawRelease, RawStatusRecord } from './raw.ts'

export interface Sources extends ProductSources {
  releases: RawRelease[]
  orders: RawOrder[]
  brands: RawNamed[]
  /** Machine models — published by 1С on 2026-10-13 */
  models: RawNamed[]
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
const RELEASE_FIELDS = ['Ref_Key', 'Number', 'ГаражныйНомер_Key', 'Клиент_Key']
const ORDER_FIELDS = ['Ref_Key', 'Number']
/**
 * How long a `$filter` of keys may get once encoded. 1С is published through IIS, which
 * answers a query string over 2 048 characters with a bare 404; the rest of the query
 * (`$select`, paging) takes up to about 300. A Cyrillic field name costs six characters a
 * letter encoded — `Изделие_Key` is 46 — so batches are measured, not counted.
 */
export const FILTER_BUDGET = 1500

/**
 * Reads one set that the sync can do without for a while: on failure it gives the
 * set's last good copy instead, so one set 1С stops giving does not stop the rest
 * (1С developer, 2026-10-22). `keep` marks a read of only some rows: it is not
 * saved as the copy, and a failure gives the copy's rows it keeps. The items and
 * their register are never read through it — without them there is nothing to sync.
 */
export type Spare = <T>(
  entity: string,
  fetch: () => Promise<T[]>,
  keep?: (row: T) => boolean,
) => Promise<T[]>

/** No stand-in: a failure fails the sync, as a bare client does. */
const asIs: Spare = (_entity, fetch) => fetch()

/** The small reference sets — catalogue numbers, components, machines — read whole each time. */
async function fetchReference(client: ODataClient, spare: Spare) {
  const whole = <T>(entity: string, select?: string[]) =>
    spare<T>(entity, () => client.all<T>(entity, select ? { select } : {}))
  const [catalogNumbers, components, equipment, brands, models, types] = await Promise.all([
    whole('Catalog_КаталожныеНомера'),
    whole('Catalog_Комплектующие'),
    whole('Catalog_Техника'),
    whole('Catalog_Марки'),
    whole<RawNamed>('Catalog_Модели', ['Ref_Key', 'Description']),
    whole('Catalog_ТипТехники'),
  ])
  return { catalogNumbers, components, equipment, brands, models, types }
}

/**
 * Reads every set the adapters need. Nothing is joined here: the raw rows go to
 * the adapters as they are, so a wrong assumption shows up in one place.
 */
export async function fetchSources(client: ODataClient, spare: Spare = asIs): Promise<Sources> {
  const [items, statuses, releases, orders, reference] = await Promise.all([
    client.all('Catalog_Изделия', { pageSize: 500 }),
    client.all(REGISTER, { select: STATUS_FIELDS }),
    spare('Document_Выпуск', () => client.all('Document_Выпуск', { select: RELEASE_FIELDS })),
    spare('Document_ЗаказыКлиента', () =>
      client.all('Document_ЗаказыКлиента', { select: ORDER_FIELDS }),
    ),
    fetchReference(client, spare),
  ])
  return { items, statuses, releases, orders, ...reference } as Sources
}

/**
 * `field eq guid'…' or …` over all `keys`, cut so each filter fits the URL once encoded.
 * A composite field (a register's `Recorder`) compares only as `cast(guid'…', 'Type')`.
 */
export function keyFilters(field: string, keys: string[], castTo?: string): string[] {
  const filters: string[] = []
  let batch: string[] = []
  let size = 0
  for (const key of keys) {
    const clause = castTo
      ? `${field} eq cast(${guid(key)}, '${castTo}')`
      : `${field} eq ${guid(key)}`
    const cost = encodeURIComponent(batch.length ? ` or ${clause}` : clause).length
    if (batch.length && size + cost > FILTER_BUDGET) {
      filters.push(batch.join(' or '))
      batch = []
      size = 0
    }
    size += batch.length ? cost : encodeURIComponent(clause).length
    batch.push(clause)
  }
  if (batch.length) filters.push(batch.join(' or '))
  return filters
}

/** Rows whose `field` is one of `keys`, as many keys per request as the URL takes. */
async function byKeys<T>(
  client: ODataClient,
  entity: string,
  field: string,
  keys: string[],
  select?: string[],
): Promise<T[]> {
  const out: T[] = []
  for (const filter of keyFilters(field, keys))
    out.push(...(await client.all<T>(entity, { filter, select })))
  return out
}

/**
 * The clients: their names for the letter about data 1С keeps twice and differently
 * (question 24); with the supplier branch and INN for registering a company (2026-10-22).
 */
export const fetchClients = (client: ODataClient, spare: Spare = asIs) =>
  spare<RawNamed>('Catalog_Клиенты', () =>
    client.all<RawNamed>('Catalog_Клиенты', {
      select: ['Ref_Key', 'Description', 'ИНН', 'Филиал_Key', 'DeletionMark'],
    }),
  )

/** The supplier's branches, whose mailboxes a client's letters go to (2026-10-22). */
export const fetchFilials = (client: ODataClient, spare: Spare = asIs) =>
  spare<RawNamed>('Catalog_Филиалы', () =>
    client.all<RawNamed>('Catalog_Филиалы', {
      select: ['Ref_Key', 'Description', 'DeletionMark'],
    }),
  )

/** Every item's version, cheap enough to read on each check (4 269 items: under a second). */
export const fetchVersions = (client: ODataClient) =>
  client.all<ItemVersion>('Catalog_Изделия', { select: ['Ref_Key', 'DataVersion', 'DeletionMark'] })

/** Every «Выпуск» document's version: a reposted one, even with an old date, shows as a new one. */
export const fetchReleaseVersions = (client: ODataClient) =>
  client.all<{ Ref_Key: string; DataVersion: string }>('Document_Выпуск', {
    select: ['Ref_Key', 'DataVersion'],
  })

/** The items the given documents record statuses for. */
export async function itemsRecordedBy(client: ODataClient, documents: string[]): Promise<string[]> {
  const lines: Pick<RawStatusRecord, 'Изделие_Key'>[] = []
  for (const filter of keyFilters('Recorder', documents, 'Document_Выпуск'))
    lines.push(
      ...(await client.all<Pick<RawStatusRecord, 'Изделие_Key'>>(REGISTER, {
        filter,
        select: ['Изделие_Key'],
      })),
    )
  return [...new Set(lines.map((l) => l.Изделие_Key))]
}

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
export async function fetchSourcesFor(
  client: ODataClient,
  ids: string[],
  spare: Spare = asIs,
): Promise<Sources> {
  const [items, statuses, reference] = await Promise.all([
    byKeys<ProductSources['items'][number]>(client, 'Catalog_Изделия', 'Ref_Key', ids),
    byKeys<RawStatusRecord>(client, REGISTER, 'Изделие_Key', ids, STATUS_FIELDS),
    fetchReference(client, spare),
  ])
  const recorders = (type: string) => [
    ...new Set(statuses.filter((s) => s.Recorder_Type.endsWith(type)).map((s) => s.Recorder)),
  ]
  const documents = <T extends { Ref_Key: string }>(entity: string, fields: string[]) => {
    const keys = recorders(entity)
    const wanted = new Set(keys)
    return spare<T>(
      entity,
      () => byKeys<T>(client, entity, 'Ref_Key', keys, fields),
      (d) => wanted.has(d.Ref_Key),
    )
  }
  const [releases, orders] = await Promise.all([
    documents<RawRelease>('Document_Выпуск', RELEASE_FIELDS),
    documents<RawOrder>('Document_ЗаказыКлиента', ORDER_FIELDS),
  ])
  return { items, statuses, releases, orders, ...reference } as Sources
}
