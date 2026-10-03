import { DEFAULT_RULES, statusOf } from '@/entities/product/rules'
import { applySettings, branchSummaries, equipment, products, settings, users } from './data'

const warnHoses = () => products.filter((p) => p.status === 'warn').length
const warnOnMachines = () => equipment.reduce((sum, e) => sum + e.statusBreakdown.warn, 0)

describe('mock administration', () => {
  afterEach(() => applySettings(DEFAULT_RULES))

  it('starts from the agreed rule: the last 30 days before the planned replacement', () => {
    expect(settings).toMatchObject({ warnRule: 'days', warnDays: 30 })
  })

  it('re-derives hose health and the machine counts built on it from the «Внимание» threshold', () => {
    const hoses = warnHoses()
    const machines = warnOnMachines()
    applySettings({ warnDays: 120 })
    expect(warnHoses()).toBeGreaterThan(hoses)
    expect(warnOnMachines()).toBeGreaterThan(machines)
    applySettings({ warnDays: 30 })
    expect(warnHoses()).toBe(hoses)
  })

  it('switches between the days and the percent rule', () => {
    const hoses = warnHoses()
    applySettings({ warnRule: 'percent', warnPercent: 50 })
    expect(warnHoses()).toBeGreaterThan(hoses)
    applySettings({ warnRule: 'days' })
    expect(warnHoses()).toBe(hoses)
  })

  it('keeps every stored status equal to the rule applied today', () => {
    for (const p of products.filter((x) => x.lifecycle !== 'written_off'))
      expect(p.status).toBe(statusOf(p, settings))
  })

  it('counts company-wide users in every branch', () => {
    const companyWide = users.filter((u) => u.active && u.branchIds.length === 0).length
    for (const b of branchSummaries()) expect(b.userCount).toBeGreaterThanOrEqual(companyWide)
  })
})
