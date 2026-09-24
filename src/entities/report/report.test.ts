import { describe, expect, it } from 'vitest'
import { periodText, presetPeriod, reportFileName, reportText } from './report'

describe('report periods', () => {
  const today = new Date('2026-09-24T12:00:00')

  it('looks back for history and ahead for a plan', () => {
    expect(presetPeriod('30', 'past', today)).toEqual({ from: '2026-08-25', to: '2026-09-24' })
    expect(presetPeriod('90', 'future', today)).toEqual({ from: '2026-09-24', to: '2026-12-23' })
  })

  it('reads a period as dates people write', () => {
    expect(periodText({ from: '2026-09-01', to: '2026-09-30' })).toBe('01.09.2026 — 30.09.2026')
  })
})

describe('reportText', () => {
  it('formats by column type and leaves empties empty', () => {
    expect(reportText({ key: 'd', header: '', type: 'date' }, '2026-02-27')).toBe('27.02.2026')
    expect(reportText({ key: 's', header: '', type: 'status' }, 'replace')).toBe('Требуется замена')
    expect(reportText({ key: 'n', header: '', type: 'number' }, 12000)).toBe('12\u00a0000')
    expect(reportText({ key: 't', header: '', type: 'text' }, null)).toBeNull()
  })

  it('names files so they sort by date', () => {
    expect(reportFileName('План замен', '2026-09-24T07:10:00Z')).toBe('план-замен-2026-09-24')
  })
})
