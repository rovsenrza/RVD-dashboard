import { statusOf } from '@/entities/product/rules'
import { applySettings, branchSummaries, equipment, products, settings, users } from './data'

const warnHoses = () => products.filter((p) => p.status === 'warn').length
const warnOnMachines = () => equipment.reduce((sum, e) => sum + e.statusBreakdown.warn, 0)

describe('mock administration', () => {
  afterEach(() => applySettings({ warnRule: 'percent', warnPercent: 20, warnDays: 60 }))

  it('re-derives hose health and the machine counts built on it from the «Внимание» threshold', () => {
    const hoses = warnHoses()
    const machines = warnOnMachines()
    applySettings({ warnPercent: 40 })
    expect(warnHoses()).toBeGreaterThan(hoses)
    expect(warnOnMachines()).toBeGreaterThan(machines)
    applySettings({ warnPercent: 20 })
    expect(warnHoses()).toBe(hoses)
  })

  it('switches between the percent and the days rule', () => {
    const hoses = warnHoses()
    applySettings({ warnRule: 'days', warnDays: 180 })
    expect(warnHoses()).toBeGreaterThan(hoses)
    applySettings({ warnRule: 'percent' })
    expect(warnHoses()).toBe(hoses)
  })

  it('keeps every stored status equal to the rule applied today', () => {
    for (const p of products.filter((x) => x.lifecycle !== 'written_off'))
      expect(p.status).toBe(statusOf(p, settings))
  })

  it('binds every mechanic to exactly one branch', () => {
    for (const u of users.filter((x) => x.role === 'mechanic')) expect(u.branchIds).toHaveLength(1)
  })

  it('counts company-wide users in every branch', () => {
    const companyWide = users.filter((u) => u.active && u.branchIds.length === 0).length
    for (const b of branchSummaries()) expect(b.userCount).toBeGreaterThanOrEqual(companyWide)
  })
})
