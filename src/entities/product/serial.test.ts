import { sameSerial } from './serial'

describe('sameSerial', () => {
  it('matches a typed serial against 1С’s padded one, and nothing looser', () => {
    expect(sameSerial('000002209', '2209')).toBe(true)
    expect(sameSerial('000002209', ' 000002209 ')).toBe(true)
    expect(sameSerial('000002209', '220')).toBe(false)
    expect(sameSerial('0', '000')).toBe(true)
  })
})
