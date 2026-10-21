import { describe, expect, it } from 'vitest'
import { isUnavailable } from './syncState'

const NOW = new Date('2026-10-07T12:00:00Z').getTime()
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString()

describe('when the cabinet says 1С is down', () => {
  it('stays quiet while 1С answers, however old the data', () => {
    expect(isUnavailable({ syncedAt: ago(300), unavailableSince: null, running: false }, NOW)).toBe(
      false,
    )
  })

  it('lets one missed check pass, then speaks once the data is half an hour old', () => {
    expect(
      isUnavailable({ syncedAt: ago(12), unavailableSince: ago(2), running: false }, NOW),
    ).toBe(false)
    expect(
      isUnavailable({ syncedAt: ago(31), unavailableSince: ago(21), running: false }, NOW),
    ).toBe(true)
  })

  it('speaks at once when there is no data at all', () => {
    expect(isUnavailable({ syncedAt: null, unavailableSince: ago(1), running: false }, NOW)).toBe(
      true,
    )
    expect(isUnavailable(undefined, NOW)).toBe(false)
  })
})
