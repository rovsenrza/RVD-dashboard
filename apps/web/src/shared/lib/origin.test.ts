import { beforeEach, describe, expect, it } from 'vitest'
import { originOf, readOrigin } from './origin'

const FALLBACK = { to: '/products', label: 'К списку изделий' }

describe('originOf', () => {
  it('keeps the filters of the registry it leaves', () => {
    expect(originOf('/products', '?status=warn')).toEqual({
      to: '/products?status=warn',
      label: 'К списку изделий',
    })
  })

  it('names the machine card and the replacement journal apart', () => {
    expect(originOf('/equipment/eq-1')?.label).toBe('К технике')
    expect(originOf('/replacements', '?reason=breakage')?.to).toBe('/replacements?reason=breakage')
  })

  it('does not treat a hose card as a starting point', () => {
    expect(originOf('/products/p-1')).toBeNull()
  })
})

describe('readOrigin', () => {
  beforeEach(() => sessionStorage.clear())

  it('falls back to the registry when nothing is remembered', () => {
    expect(readOrigin(FALLBACK)).toEqual(FALLBACK)
  })

  it('returns what was remembered, and ignores garbage', () => {
    sessionStorage.setItem(
      'rvd.origin',
      JSON.stringify({ to: '/equipment/eq-1', label: 'К технике' }),
    )
    expect(readOrigin(FALLBACK).to).toBe('/equipment/eq-1')
    sessionStorage.setItem('rvd.origin', '{oops')
    expect(readOrigin(FALLBACK)).toEqual(FALLBACK)
  })
})
