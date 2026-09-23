import type { ModelStats } from '@/entities/types'
import { bestOf, METRICS } from './metrics'

const model = (name: string, patch: Partial<ModelStats>): ModelStats => ({
  model: name,
  type: 'Экскаватор',
  machines: 4,
  hoses: 40,
  breakdown: { ok: 30, warn: 4, replace: 2, no_warranty: 4 },
  replacements12m: 8,
  replacementsPerMachine: 2,
  failureShare: 0.25,
  avgServiceDays: 300,
  avgUsage: { value: 2000, unit: 'hours' },
  topPlace: 'Ковш',
  ...patch,
})
const metric = (label: string) => METRICS.find((m) => m.label === label)!

describe('best model per metric', () => {
  it('marks the lower value where fewer is better, the higher where more is better', () => {
    const a = model('A', { replacementsPerMachine: 1.5, avgServiceDays: 280 })
    const b = model('B', { replacementsPerMachine: 2.5, avgServiceDays: 410 })
    expect(bestOf(metric('Замен на единицу за 12 месяцев'), [a, b])).toBe('A')
    expect(bestOf(metric('Средний срок службы до замены'), [a, b])).toBe('B')
  })

  it('names no winner on a tie, without data, or where «better» depends on context', () => {
    const a = model('A', {})
    const b = model('B', {})
    expect(bestOf(metric('Замен на единицу за 12 месяцев'), [a, b])).toBeNull()
    expect(
      bestOf(metric('Средний срок службы до замены'), [a, model('B', { avgServiceDays: null })]),
    ).toBeNull()
    expect(bestOf(metric('Единиц техники'), [a, model('B', { machines: 9 })])).toBeNull()
  })

  it('ties models whose values read the same once rounded for display', () => {
    const a = model('A', { failureShare: 0.227 })
    const b = model('B', { failureShare: 0.231 })
    expect(bestOf(metric('Доля поломок среди замен'), [a, b])).toBeNull()
  })

  it('compares the share needing replacement, not the raw count', () => {
    const small = model('Small', {
      hoses: 10,
      breakdown: { ok: 7, warn: 0, replace: 3, no_warranty: 0 },
    })
    const large = model('Large', {
      hoses: 100,
      breakdown: { ok: 90, warn: 4, replace: 6, no_warranty: 0 },
    })
    expect(bestOf(metric('Требуют замены'), [small, large])).toBe('Large')
  })
})
