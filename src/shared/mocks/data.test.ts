import { DEFAULT_RULES, statusOf } from '@/entities/product/rules'
import { applySettings, branchSummaries, equipment, products, settings, users } from './data'

const warnHoses = () => products.filter((p) => p.status === 'warn').length
const warnOnMachines = () => equipment.reduce((sum, e) => sum + e.statusBreakdown.warn, 0)

describe('mock administration', () => {
  afterEach(() => applySettings(DEFAULT_RULES))

  it('starts from the agreed rule: the last 30 days before the planned replacement', () => {
    expect(settings).toMatchObject({ warnRule: 'days', warnDays: 30 })
  })

  it('keeps hose health and machine counts whatever the old «Внимание» setting says', () => {
    const hoses = warnHoses()
    const machines = warnOnMachines()
    applySettings({ warnRule: 'percent', warnPercent: 50, warnDays: 120 })
    expect(warnHoses()).toBe(hoses)
    expect(warnOnMachines()).toBe(machines)
    applySettings({ warnRule: 'days', warnDays: 30 })
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
