import { describe, expect, it } from 'vitest'
import { formatISO, subDays } from 'date-fns'
import type { ReportId } from '@/entities/types'
import { REPORTS } from '@/entities/report'
import { buildReport } from './reports'
import { equipment, products, replacements } from './data'

const day = (d: Date) => formatISO(d, { representation: 'date' })
const today = day(new Date())
const all = { branch: null, from: null, to: null }

describe('reports', () => {
  it('builds every report in the catalogue, with a value for every column', () => {
    for (const { id } of REPORTS) {
      const r = buildReport(id, all)!
      expect(r.id).toBe(id)
      for (const row of r.rows)
        expect(Object.keys(row).sort()).toEqual(r.columns.map((c) => c.key).sort())
    }
  })

  it('refuses an unknown report', () => {
    expect(buildReport('nope' as ReportId, all)).toBeNull()
  })

  it('keeps to the branch in scope', () => {
    const north = buildReport('registry', { ...all, branch: 'b-north' })!
    const serials = new Set(
      products.filter((p) => p.branchId === 'b-north').map((p) => p.serialNumber),
    )
    expect(north.branch).toBe('Северный филиал')
    expect(north.rows.length).toBeGreaterThan(0)
    expect(north.rows.every((r) => serials.has(String(r.serial)))).toBe(true)
  })

  it('counts only replacements inside the period', () => {
    const from = day(subDays(new Date(), 90))
    const r = buildReport('replacements', { branch: null, from, to: today })!
    expect(r.period).toEqual({ from, to: today })
    expect(r.rows.length).toBe(replacements.filter((x) => x.date >= from && x.date <= today).length)
    expect(r.rows.every((x) => String(x.date) >= from)).toBe(true)
  })

  it('totals the countable columns of a statistics report', () => {
    const r = buildReport('equipment', all)!
    expect(r.rows.length).toBe(equipment.length)
    expect(r.totals).toMatchObject({ machine: 'Итого' })
    expect(r.totals!.hoses).toBe(r.rows.reduce((s, x) => s + Number(x.hoses), 0))
    const statuses = ['ok', 'warn', 'replace', 'no_warranty'].reduce(
      (s, k) => s + Number(r.totals![k]),
      0,
    )
    expect(statuses).toBe(r.totals!.hoses)
  })

  it('plans what runs out in the period and what has already run out', () => {
    const to = day(new Date(Date.now() + 90 * 86_400_000))
    const r = buildReport('plan', { branch: null, from: today, to })!
    expect(r.rows.length).toBeGreaterThan(0)
    expect(r.rows.every((x) => String(x.planned) <= to)).toBe(true)
    expect(r.rows.some((x) => String(x.planned) < today)).toBe(true)
  })
})
