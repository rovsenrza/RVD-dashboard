import type { RawEquipment, RawItem, RawNamed, RawRelease, RawStatusRecord } from '../raw.ts'
import { byKey, cleanText, displayCode, isRef } from './common.ts'
import { statusesByItem } from './product.ts'

/**
 * Data 1С keeps twice and differently (question 24). The 1С developer (2026-10-08): the
 * statuses register and the item are the truth, a copy that disagrees is an error, and he
 * wants to hear of each one.
 */
export type DiscrepancyKind = 'machine_client' | 'release_machine' | 'release_client'

export interface Discrepancy {
  /** The kind, the item and both values: the same disagreement keeps its key from run to run */
  key: string
  kind: DiscrepancyKind
  productId: string
  /** One line of the letter */
  text: string
}

export interface DiscrepancySources {
  items: RawItem[]
  statuses: RawStatusRecord[]
  releases: RawRelease[]
  equipment: RawEquipment[]
  clients: RawNamed[]
}

/**
 * Each item against its machine (whose owner is a client too) and against the latest
 * «Выпуск» that recorded its status. Older «Выпуски» are history: a hose moved to another
 * machine leaves them behind. An empty field on either side is not a disagreement.
 */
export function findDiscrepancies(src: DiscrepancySources): Discrepancy[] {
  const machines = byKey(src.equipment, (e) => e.Ref_Key)
  const releases = byKey(src.releases, (r) => r.Ref_Key)
  const clients = byKey(src.clients, (c) => c.Ref_Key)
  const histories = statusesByItem(src.statuses)
  const client = (key: string) => `«${cleanText(clients.get(key)?.Description) || key}»`
  const machine = (key: string) => `«${cleanText(machines.get(key)?.Description) || key}»`
  const found: Discrepancy[] = []

  for (const item of src.items) {
    if (item.DeletionMark) continue
    // 1С has two series of codes (9 and 20 digits) that share 256 numbers across clients:
    // the number alone does not name the hose, the number and its client do.
    const at = `Изделие ${displayCode(item.Code)} (${client(item.Клиент_Key)}):`
    const add = (kind: DiscrepancyKind, values: [string, string], text: string) =>
      found.push({
        key: [kind, item.Ref_Key, ...values].join(':'),
        kind,
        productId: item.Ref_Key,
        text,
      })

    const owner = isRef(item.Owner_Key) ? machines.get(item.Owner_Key)?.Owner_Key : undefined
    if (isRef(owner) && owner !== item.Клиент_Key)
      add(
        'machine_client',
        [item.Клиент_Key, owner],
        `${at} его техника ${machine(item.Owner_Key)} записана на клиента ${client(owner)}`,
      )

    const release = (histories.get(item.Ref_Key) ?? [])
      .map((r) => releases.get(r.Recorder))
      .filter((r) => r !== undefined)
      .at(-1)
    if (!release) continue
    const doc = `в «Выпуске» ${displayCode(release.Number)}`
    if (
      isRef(release.ГаражныйНомер_Key) &&
      isRef(item.Owner_Key) &&
      release.ГаражныйНомер_Key !== item.Owner_Key
    )
      add(
        'release_machine',
        [item.Owner_Key, release.ГаражныйНомер_Key],
        `${at} в изделии техника ${machine(item.Owner_Key)}, а ${doc} — ${machine(release.ГаражныйНомер_Key)}`,
      )
    if (isRef(release.Клиент_Key) && release.Клиент_Key !== item.Клиент_Key)
      add(
        'release_client',
        [item.Клиент_Key, release.Клиент_Key],
        `${at} ${doc} клиент ${client(release.Клиент_Key)}`,
      )
  }
  return found
}
