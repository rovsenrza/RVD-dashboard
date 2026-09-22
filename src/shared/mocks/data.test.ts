import { applySettings, branchSummaries, equipment, products, users } from './data'

const warnHoses = () => products.filter((p) => p.status === 'warn').length
const warnOnMachines = () => equipment.reduce((sum, e) => sum + e.statusBreakdown.warn, 0)

describe('mock administration', () => {
  afterEach(() => applySettings({ warnPercent: 20 }))

  it('re-derives hose health and the machine counts built on it from the «Внимание» threshold', () => {
    const hoses = warnHoses()
    const machines = warnOnMachines()
    applySettings({ warnPercent: 40 })
    expect(warnHoses()).toBeGreaterThan(hoses)
    expect(warnOnMachines()).toBeGreaterThan(machines)
    applySettings({ warnPercent: 20 })
    expect(warnHoses()).toBe(hoses)
  })

  it('binds every mechanic to exactly one branch', () => {
    for (const u of users.filter((x) => x.role === 'mechanic')) expect(u.branchIds).toHaveLength(1)
  })

  it('counts company-wide users in every branch', () => {
    const companyWide = users.filter((u) => u.active && u.branchIds.length === 0).length
    for (const b of branchSummaries()) expect(b.userCount).toBeGreaterThanOrEqual(companyWide)
  })
})
