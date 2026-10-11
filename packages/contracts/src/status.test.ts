import {
  daysLeft,
  lifetimePhases,
  rulesProblem,
  serviceDates,
  statusOf,
  type ServiceFacts,
  type StatusRules,
} from './status'

const PERCENT: StatusRules = { warnRule: 'percent', warnPercent: 20, warnDays: 60 }
const DAYS: StatusRules = { ...PERCENT, warnRule: 'days' }

/** A year of warranty — the customer's example: 180 green, 90 yellow, 90 red, 90 grey. */
const hose: ServiceFacts = {
  installedAt: '2026-01-01',
  shippedAt: '2025-12-20',
  serviceLifeDays: 730,
  warrantyDays: 360,
}
const on = (iso: string) => new Date(`${iso}T12:00:00`)

describe('status rule', () => {
  it('lays the life out on the warranty: half ok, a quarter warn, a quarter replace, then grey', () => {
    expect(serviceDates(hose)).toMatchObject({
      warnFrom: '2026-06-30',
      plannedAt: '2026-09-28',
      warrantyUntil: '2026-12-27',
      endsAt: '2027-03-27',
    })
    expect(lifetimePhases(serviceDates(hose)!).map((p) => p.status)).toEqual([
      'ok',
      'warn',
      'replace',
      'no_warranty',
    ])
  })

  it('walks ok → warn → replace, each boundary day in the later phase, and stays replace', () => {
    expect(statusOf(hose, PERCENT, on('2026-06-29'))).toBe('ok')
    expect(statusOf(hose, PERCENT, on('2026-06-30'))).toBe('warn')
    expect(statusOf(hose, PERCENT, on('2026-09-27'))).toBe('warn')
    expect(statusOf(hose, PERCENT, on('2026-09-28'))).toBe('replace')
    expect(statusOf(hose, PERCENT, on('2027-06-01'))).toBe('replace')
  })

  it('no longer reads the «Внимание» setting', () => {
    expect(serviceDates(hose, DAYS)).toEqual(serviceDates(hose, PERCENT))
  })

  it('measures nothing without a warranty on record', () => {
    expect(serviceDates({ ...hose, warrantyDays: 0 })).toBeNull()
    expect(statusOf({ ...hose, warrantyDays: 0 }, DAYS, on('2030-01-01'))).toBe('no_warranty')
    expect(daysLeft({ ...hose, warrantyDays: 0 })).toBeNull()
  })

  it('counts from shipment when the installation date is unknown', () => {
    const stock = { ...hose, installedAt: null }
    const d = serviceDates(stock, PERCENT)!
    expect(d).toMatchObject({ start: '2025-12-20', basis: 'shipped', plannedAt: '2026-09-16' })
    expect(statusOf(stock, PERCENT, on('2026-09-16'))).toBe('replace')
    expect(daysLeft(stock, on('2026-09-06'))).toBe(10)
  })

  it('agrees with its own timeline on every day up to the grey stretch', () => {
    const d = serviceDates(hose, PERCENT)!
    const phases = lifetimePhases(d)
    for (let t = on('2026-01-01'); t < on(d.warrantyUntil); t.setDate(t.getDate() + 1)) {
      const iso = t.toISOString().slice(0, 10)
      const phase = phases.find((p) => p.from <= iso && (!p.to || iso < p.to))!
      expect(statusOf(hose, PERCENT, t)).toBe(phase.status)
    }
  })

  it('rejects rules outside the agreed ranges', () => {
    expect(rulesProblem({ warnPercent: 20, warnDays: 60, warnRule: 'days' })).toBeNull()
    expect(rulesProblem({ warnPercent: 70 })).not.toBeNull()
    expect(rulesProblem({ warnDays: 2.5 })).not.toBeNull()
    expect(rulesProblem({ warnRule: 'months' as never })).not.toBeNull()
  })
})
