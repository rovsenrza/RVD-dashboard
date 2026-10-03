import { MAX_REQUEST_POSITIONS, requestProblem, type RequestDraft } from './requests'
import type { Product, RequestPosition } from './types'

const hose = (id: string, lifecycle: Product['lifecycle'] = 'in_operation') =>
  ({ id, serialNumber: id.toUpperCase(), lifecycle }) as Product
const hoses = new Map(
  [hose('h1'), hose('h2', 'written_off'), hose('h3', 'manufacturing')].map((h) => [h.id, h]),
)
const ctx = (fileNames: string[] = []) => ({ productOf: (id: string) => hoses.get(id), fileNames })

const line = (part: Partial<RequestPosition>): RequestPosition => ({
  productId: null,
  catalogNumberId: null,
  catalogNumber: '07098-010A9',
  equipmentId: null,
  quantity: 1,
  ...part,
})
const draft = (kind: RequestDraft['kind'], positions: RequestPosition[]): RequestDraft => ({
  kind,
  positions,
})

describe('requestProblem', () => {
  it('takes a replacement of the company’s own hoses, archive included', () => {
    const lines = [line({ productId: 'h1' }), line({ productId: 'h2' })]
    expect(requestProblem(draft('replace', lines), ctx())).toBeNull()
  })

  it('never takes a typed number, a hose still being made or the same hose twice for a replacement', () => {
    expect(requestProblem(draft('replace', [line({})]), ctx())).toMatch(/только ваши изделия/)
    expect(requestProblem(draft('replace', [line({ productId: 'h3' })]), ctx())).toMatch(
      /ещё изготавливается/,
    )
    const twice = [line({ productId: 'h1' }), line({ productId: 'h1' })]
    expect(requestProblem(draft('replace', twice), ctx())).toMatch(/дважды/)
    expect(requestProblem(draft('replace', []), ctx(['список.xlsx']))).toMatch(/Выберите изделия/)
  })

  it('lets manufacture and repair go with typed numbers, or with only an Excel file', () => {
    for (const kind of ['manufacture', 'repair'] as const) {
      expect(
        requestProblem(draft(kind, [line({ catalogNumber: 'НЕТ-В-СПРАВОЧНИКЕ' })]), ctx()),
      ).toBeNull()
      expect(requestProblem(draft(kind, []), ctx(['Позиции.XLSX']))).toBeNull()
      expect(requestProblem(draft(kind, []), ctx(['фото.jpg']))).toMatch(/таблицу Excel/)
    }
  })

  it('caps a request at ten lines', () => {
    const many = Array.from({ length: MAX_REQUEST_POSITIONS + 1 }, () => line({}))
    expect(requestProblem(draft('manufacture', many), ctx())).toMatch(/не больше 10/)
    expect(requestProblem(draft('manufacture', many.slice(1)), ctx())).toBeNull()
  })

  it('names a line without a number or with an impossible quantity', () => {
    expect(requestProblem(draft('manufacture', [line({ catalogNumber: ' ' })]), ctx())).toMatch(
      /каталожный номер/,
    )
    expect(requestProblem(draft('repair', [line({ catalogNumber: ' ' })]), ctx())).toMatch(
      /Опишите, что отремонтировать/,
    )
    expect(requestProblem(draft('repair', [line({ quantity: 0 })]), ctx())).toMatch(/от 1 до 99/)
  })

  it('lets a repair name the company’s hoses, describe other work, or both', () => {
    const hose = line({ productId: 'h1', catalogNumber: null })
    const work = line({ catalogNumber: '2SC ду10 — течь у муфты', quantity: 2 })
    expect(requestProblem(draft('repair', [hose]), ctx())).toBeNull()
    expect(requestProblem(draft('repair', [work]), ctx())).toBeNull()
    expect(requestProblem(draft('repair', [hose, work]), ctx())).toBeNull()
  })

  it('sends no written-off or unknown hose to repair, and no hose at all to manufacture', () => {
    expect(requestProblem(draft('repair', [line({ productId: 'h2' })]), ctx())).toMatch(/списано/)
    expect(requestProblem(draft('repair', [line({ productId: 'nope' })]), ctx())).toMatch(
      /только ваши изделия/,
    )
    expect(requestProblem(draft('manufacture', [line({ productId: 'h1' })]), ctx())).toMatch(
      /выберите «Замена»/,
    )
  })
})
