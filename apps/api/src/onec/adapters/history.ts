import type { LifecycleRecord } from '@rvd/contracts'
import type { RawItem, RawOrder, RawRelease, RawStatusRecord } from '../raw.ts'
import { byKey, cleanText, displayCode } from './common.ts'
import { stageOf, statusesByItem } from './product.ts'

export interface HistorySources {
  items: RawItem[]
  statuses: RawStatusRecord[]
  releases: RawRelease[]
  orders: RawOrder[]
}

/**
 * The status in words, as 1С names it: «НаОформлении» → «На оформлении»,
 * «ВЭксплуатации» → «В эксплуатации». The empty status is the line that only
 * created the item. A status 1С adds later reads the same way.
 */
export function statusText(raw: string | null | undefined): string {
  const status = cleanText(raw)
  if (!status) return 'Создано'
  const [first, ...rest] = status.replace(/(?<=[А-ЯЁа-яё])(?=[А-ЯЁ][а-яё])/g, ' ').split(' ')
  return [first, ...rest.map((w) => w.toLowerCase())].join(' ')
}

const documentKind = (recorderType: string): LifecycleRecord['document']['kind'] =>
  recorderType.endsWith('Document_Выпуск')
    ? 'release'
    : recorderType.endsWith('Document_ЗаказыКлиента')
      ? 'order'
      : 'other'

/**
 * Each live item's history, oldest first, straight from the statuses register:
 * every line it holds, the stage it means (null for a status the cabinet does
 * not know yet, such as a repair) and the document that recorded it.
 */
export function toHistory(src: HistorySources): Map<string, LifecycleRecord[]> {
  const releases = byKey(src.releases, (r) => r.Ref_Key)
  const orders = byKey(src.orders, (o) => o.Ref_Key)
  const live = new Set(src.items.filter((i) => !i.DeletionMark).map((i) => i.Ref_Key))
  const out = new Map<string, LifecycleRecord[]>()
  for (const [productId, records] of statusesByItem(src.statuses)) {
    if (!live.has(productId)) continue
    out.set(
      productId,
      records.map((r, i) => {
        const kind = documentKind(r.Recorder_Type)
        const number =
          kind === 'release'
            ? releases.get(r.Recorder)?.Number
            : kind === 'order'
              ? orders.get(r.Recorder)?.Number
              : undefined
        return {
          id: `${productId}:${i}`,
          productId,
          at: r.Period,
          lifecycle: stageOf(r.Статус),
          status: statusText(r.Статус),
          document: { kind, number: number ? displayCode(number) : null },
          author: null,
        }
      }),
    )
  }
  return out
}
