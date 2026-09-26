import {
  daysLeft,
  lifetimePhases,
  rulesProblem,
  serviceDates,
  statusOf,
  type ServiceFacts,
  type StatusRules,
} from './rules'

const PERCENT: StatusRules = { warnRule: 'percent', warnPercent: 20, warnDays: 60 }
const DAYS: StatusRules = { ...PERCENT, warnRule: 'days' }

/** 12 months of service, 6 of warranty — the ТЗ example. */
const hose: ServiceFacts = {
  installedAt: '2026-01-01',
  shippedAt: '2025-12-20',
  serviceLifeDays: 365,
  warrantyDays: 180,
}
const on = (iso: string) => new Date(`${iso}T12:00:00`)

describe('status rule', () => {
  it('walks ok → no_warranty → warn → replace, each boundary day in the later phase', () => {
    expect(statusOf(hose, PERCENT, on('2026-06-29'))).toBe('ok')
    expect(statusOf(hose, PERCENT, on('2026-06-30'))).toBe('no_warranty')
    // 20 % of 365 = 73 days before 2027-01-01
    expect(statusOf(hose, PERCENT, on('2026-10-20'))).toBe('warn')
    expect(statusOf(hose, PERCENT, on('2026-10-19'))).toBe('no_warranty')
    expect(statusOf(hose, PERCENT, on('2026-12-31'))).toBe('warn')
    expect(statusOf(hose, PERCENT, on('2027-01-01'))).toBe('replace')
  })

  it('counts «Внимание» as fixed days before the planned replacement under the days rule', () => {
    expect(serviceDates(hose, DAYS)!.warnFrom).toBe('2026-11-02')
    expect(statusOf(hose, DAYS, on('2026-11-01'))).toBe('no_warranty')
    expect(statusOf(hose, DAYS, on('2026-11-02'))).toBe('warn')
  })

  it('lets «Внимание» win over a warranty that is still running', () => {
    const long = { ...hose, warrantyDays: 360 }
    expect(statusOf(long, PERCENT, on('2026-11-01'))).toBe('warn')
    expect(lifetimePhases(serviceDates(long, PERCENT)!).map((p) => p.status)).toEqual([
      'ok',
      'warn',
      'replace',
    ])
  })

  it('never starts «Внимание» before the service starts', () => {
    const short = { ...hose, serviceLifeDays: 30 }
    expect(serviceDates(short, DAYS)!.warnFrom).toBe(hose.installedAt)
  })

  it('counts from shipment when the installation date is unknown', () => {
    const stock = { ...hose, installedAt: null }
    const d = serviceDates(stock, PERCENT)!
    expect(d).toMatchObject({ start: '2025-12-20', basis: 'shipped', plannedAt: '2026-12-20' })
    expect(statusOf(stock, PERCENT, on('2026-12-20'))).toBe('replace')
    expect(daysLeft(stock, on('2026-12-10'))).toBe(10)
  })

  it('agrees with its own timeline on every day', () => {
    const d = serviceDates(hose, PERCENT)!
    const phases = lifetimePhases(d)
    for (
      let t = new Date('2026-01-01T12:00:00');
      t < on('2027-02-01');
      t.setDate(t.getDate() + 1)
    ) {
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
