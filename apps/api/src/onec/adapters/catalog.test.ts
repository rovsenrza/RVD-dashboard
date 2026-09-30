// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { byKey } from './common.ts'
import { catalogNumber, components } from '../__fixtures__/builders.ts'
import { toCatalogNumber, toComponent } from './catalog.ts'

describe('toCatalogNumber', () => {
  it('reads the numbers and lists the composition in table order', () => {
    const c = toCatalogNumber(
      catalogNumber(),
      byKey(components, (x) => x.Ref_Key),
    )
    expect(c).toMatchObject({
      name: '02753-00613',
      serviceLifeDays: 730,
      warrantyDays: 365,
      diameter: 20,
      braidCount: 4,
    })
    expect(c.composition.map((l) => l.componentId)).toEqual(['comp-hose', 'comp-fitting'])
  })
})

describe('toComponent', () => {
  it('maps the 1С component types and falls back to other', () => {
    expect(toComponent(components[0]).type).toBe('hose')
    expect(toComponent(components[1]).type).toBe('fitting')
    expect(toComponent({ ...components[0], ТипыКомплектующих: 'Прочее' }).type).toBe('other')
  })

  it('trims the name', () => {
    expect(toComponent(components[0]).name).toBe('4SH ду25 рукав')
  })
})
