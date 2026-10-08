// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { equipment, item, release, statusRecord } from '../__fixtures__/builders.ts'
import { findDiscrepancies, type DiscrepancySources } from './discrepancies.ts'

const clients = [
  { Ref_Key: 'client-1', Description: 'ООО Ромашка' },
  { Ref_Key: 'client-2', Description: 'ООО Ромашка, участок 2' },
]

const sources = (over: Partial<DiscrepancySources> = {}): DiscrepancySources => ({
  items: [item({ Owner_Key: 'eq-1' })],
  statuses: [],
  releases: [],
  equipment: [equipment()],
  clients,
  ...over,
})

describe('data 1С keeps twice and differently (question 24)', () => {
  it('finds nothing where the copies agree or one of them is empty', () => {
    expect(findDiscrepancies(sources())).toEqual([])
    expect(findDiscrepancies(sources({ items: [item()] }))).toEqual([])
    expect(
      findDiscrepancies(
        sources({ statuses: [statusRecord()], releases: [release({ ГаражныйНомер_Key: 'eq-1' })] }),
      ),
    ).toEqual([])
  })

  it('reports a machine that belongs to another client than its hose, by name', () => {
    const [d, ...rest] = findDiscrepancies(
      sources({ equipment: [equipment({ Owner_Key: 'client-2' })] }),
    )
    expect(rest).toEqual([])
    expect(d).toEqual({
      key: 'machine_client:item-1:client-1:client-2',
      kind: 'machine_client',
      productId: 'item-1',
      text: 'Изделие 3844 («ООО Ромашка»): его техника «FAW р414вв154» записана на клиента «ООО Ромашка, участок 2»',
    })
  })

  it('counts another client’s «Без привязки» placeholder too, and skips a machine it does not know', () => {
    const stub = equipment({
      Ref_Key: 'stub',
      Description: 'Без привязки к технике',
      Owner_Key: 'client-2',
    })
    const found = findDiscrepancies(
      sources({
        items: [item({ Owner_Key: 'stub' }), item({ Ref_Key: 'x', Owner_Key: 'gone' })],
        equipment: [stub],
      }),
    )
    expect(found.map((d) => d.key)).toEqual(['machine_client:item-1:client-1:client-2'])
  })

  it('compares the item with the latest «Выпуск» that recorded its status, not the older ones', () => {
    const found = findDiscrepancies(
      sources({
        equipment: [equipment(), equipment({ Ref_Key: 'eq-2', Description: 'Камаз 0321' })],
        statuses: [
          statusRecord({ Recorder: 'old', Period: '2026-01-01T00:00:00' }),
          statusRecord({ Recorder: 'new', Period: '2026-02-01T00:00:00', Статус: 'Отгружен' }),
          statusRecord({
            Recorder: 'order',
            Recorder_Type: 'StandardODATA.Document_ЗаказыКлиента',
            Period: '2026-03-01T00:00:00',
          }),
        ],
        releases: [
          release({ Ref_Key: 'old', Number: '000000007', ГаражныйНомер_Key: 'eq-1' }),
          release({
            Ref_Key: 'new',
            Number: '000000012',
            ГаражныйНомер_Key: 'eq-2',
            Клиент_Key: 'client-2',
          }),
        ],
      }),
    )
    expect(found.map((d) => [d.kind, d.text])).toEqual([
      [
        'release_machine',
        'Изделие 3844 («ООО Ромашка»): в изделии техника «FAW р414вв154», а в «Выпуске» 12 — «Камаз 0321»',
      ],
      [
        'release_client',
        'Изделие 3844 («ООО Ромашка»): в «Выпуске» 12 клиент «ООО Ромашка, участок 2»',
      ],
    ])
  })

  it('leaves out items marked for deletion', () => {
    const found = findDiscrepancies(
      sources({
        items: [item({ Owner_Key: 'eq-1', DeletionMark: true })],
        equipment: [equipment({ Owner_Key: 'client-2' })],
      }),
    )
    expect(found).toEqual([])
  })
})
