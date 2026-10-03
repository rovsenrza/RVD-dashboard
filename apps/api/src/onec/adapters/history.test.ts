// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { item, release, statusRecord } from '../__fixtures__/builders.ts'
import { statusText, toHistory, type HistorySources } from './history.ts'

const sources = (over: Partial<HistorySources> = {}): HistorySources => ({
  items: [item()],
  statuses: [],
  releases: [],
  orders: [],
  ...over,
})

describe('statusText', () => {
  it.each([
    ['НаОформлении', 'На оформлении'],
    ['ВЭксплуатации', 'В эксплуатации'],
    ['НаСкладе', 'На складе'],
    ['Изготавливается', 'Изготавливается'],
    ['', 'Создано'],
    ['ВРемонте', 'В ремонте'],
  ])('%s → %s', (raw, text) => expect(statusText(raw)).toBe(text))
})

describe('toHistory', () => {
  it('tells every register line of a hose, oldest first, with the document that recorded it', () => {
    const history = toHistory(
      sources({
        statuses: [
          statusRecord({ Recorder: 'r2', Period: '2026-08-27T09:00:00', Статус: 'Отгружен' }),
          statusRecord({ Recorder: 'r1', Period: '2026-08-18T10:00:00', Статус: '' }),
          statusRecord({
            Recorder: 'o1',
            Recorder_Type: 'StandardODATA.Document_ЗаказыКлиента',
            Period: '2026-09-01T12:00:00',
            Статус: 'ВЭксплуатации',
          }),
        ],
        releases: [
          release({ Ref_Key: 'r1', Number: '000000123' }),
          release({ Ref_Key: 'r2', Number: '000000124' }),
        ],
        orders: [{ Ref_Key: 'o1', Number: 'СВЦБ-002157' }],
      }),
    ).get('item-1')
    expect(history).toEqual([
      {
        id: 'item-1:0',
        productId: 'item-1',
        at: '2026-08-18T10:00:00',
        lifecycle: 'manufacturing',
        status: 'Создано',
        document: { kind: 'release', number: '123' },
        author: null,
      },
      expect.objectContaining({
        status: 'Отгружен',
        lifecycle: 'shipped',
        document: { kind: 'release', number: '124' },
      }),
      expect.objectContaining({
        status: 'В эксплуатации',
        lifecycle: 'in_operation',
        document: { kind: 'order', number: 'СВЦБ-002157' },
      }),
    ])
  })

  it('keeps a status the cabinet does not know yet, by its own name and with no stage', () => {
    const [line] = toHistory(sources({ statuses: [statusRecord({ Статус: 'ВРемонте' })] })).get(
      'item-1',
    )!
    expect(line).toMatchObject({ status: 'В ремонте', lifecycle: null })
  })

  it('leaves out inactive lines and items marked for deletion', () => {
    const history = toHistory(
      sources({
        items: [item(), item({ Ref_Key: 'gone', DeletionMark: true })],
        statuses: [
          statusRecord({ Статус: 'НаСкладе' }),
          statusRecord({ Статус: 'Отгружен', Active: false, Period: '2026-02-01T00:00:00' }),
          statusRecord({ Изделие_Key: 'gone' }),
        ],
      }),
    )
    expect([...history.keys()]).toEqual(['item-1'])
    expect(history.get('item-1')!.map((r) => r.status)).toEqual(['На складе'])
  })
})
