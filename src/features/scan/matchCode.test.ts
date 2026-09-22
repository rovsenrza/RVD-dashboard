import type { Equipment, Product } from '@/entities/types'
import { matchCode, normaliseCode } from './matchCode'

const products = [
  { id: 'p1', serialNumber: '48703', clientNumber: 'К-1003', oemNumber: '7432-6392' },
  { id: 'p2', serialNumber: '48704', clientNumber: null, oemNumber: '48703-X' },
] as Product[]
const equipment = [{ id: 'e1', garageNumber: 'НТ04', inventoryNumber: 'INV-77' }] as Equipment[]

describe('normaliseCode', () => {
  it.each([
    ['48703', '48703'],
    ['  EHS 48703 ', '48703'],
    ['ESM№48703', '48703'],
    ['https://rvd.example/p/48703', '48703'],
    ['https://rvd.example/scan?ehs=48703&x=1', '48703'],
  ])('%s → %s', (raw, code) => expect(normaliseCode(raw)).toBe(code))
})

describe('matchCode', () => {
  it('opens the hose by EHS, internal or OEM number', () => {
    expect(matchCode('48703', products, equipment)).toEqual({
      to: '/products/p1',
      label: 'EHS 48703',
    })
    expect(matchCode('к-1003', products, equipment)?.to).toBe('/products/p1')
    expect(matchCode('7432-6392', products, equipment)?.to).toBe('/products/p1')
  })

  it('prefers the EHS number over an OEM number that merely looks alike', () => {
    expect(matchCode('48704', products, equipment)?.to).toBe('/products/p2')
  })

  it('falls back to machines by garage or inventory number', () => {
    expect(matchCode('нт04', products, equipment)).toEqual({ to: '/equipment/e1', label: 'НТ04' })
    expect(matchCode('INV-77', products, equipment)?.to).toBe('/equipment/e1')
  })

  it('never guesses from a partial number', () => {
    expect(matchCode('4870', products, equipment)).toBeNull()
    expect(matchCode('   ', products, equipment)).toBeNull()
  })
})
