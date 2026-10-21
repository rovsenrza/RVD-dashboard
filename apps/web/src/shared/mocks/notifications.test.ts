import { describe, expect, it } from 'vitest'
import { addDays, differenceInCalendarDays, formatISO, parseISO } from 'date-fns'
import { equipment, products, settings } from './data'
import { markRead, notificationsFor, prefs } from './notifications'

const today = new Date()
const day = (d: Date) => formatISO(d, { representation: 'date' })

describe('the daily scheduler', () => {
  const list = notificationsFor(null, today)

  it('fires each hose rule exactly its lead days before the due date, within 30 days', () => {
    const hose = list.filter((n) => n.kind !== 'request_status' && n.kind !== 'inspection')
    expect(hose.length).toBeGreaterThan(0)
    for (const n of hose) {
      const fired = parseISO(n.createdAt)
      expect(day(addDays(fired, n.lead!))).toBe(n.dueDate)
      const ago = differenceInCalendarDays(today, fired)
      expect(ago).toBeGreaterThanOrEqual(0)
      expect(ago).toBeLessThan(30)
      if (n.kind !== 'overdue') expect(settings.leadDays).toContain(n.lead)
    }
  })

  it('reminds to inspect each machine every so many days from its first hose in service', () => {
    const due = list.filter((n) => n.kind === 'inspection')
    expect(due.length).toBeGreaterThan(0)
    for (const n of due) {
      const machine = equipment.find((e) => e.id === n.equipmentId)!
      const starts = products
        .filter((p) => p.equipmentId === machine.id && p.lifecycle !== 'written_off')
        .map((p) => p.installedAt || p.shippedAt)
        .filter(Boolean)
        .sort()
      const age = differenceInCalendarDays(parseISO(n.dueDate!), parseISO(starts[0]!))
      expect(age % settings.inspectionDays).toBe(0)
      expect(age).toBeGreaterThan(0)
      expect(day(parseISO(n.createdAt))).toBe(n.dueDate)
      expect(n.title).toBe(`Техника ${machine.garageNumber}`)
    }
    // The administrator turned it off: nothing.
    const every = settings.inspectionDays
    settings.inspectionDays = 0
    expect(notificationsFor(null, today).some((n) => n.kind === 'inspection')).toBe(false)
    settings.inspectionDays = every
  })

  it('comes newest first, with unique ids', () => {
    const times = list.map((n) => n.createdAt)
    expect([...times].sort().reverse()).toEqual(times)
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length)
  })

  it('keeps to the branch in scope', () => {
    expect(notificationsFor('b-north', today).every((n) => n.branchId === 'b-north')).toBe(true)
  })

  it('leaves out what the user unsubscribed from', () => {
    prefs.kinds.warranty_end = false
    expect(notificationsFor(null, today).some((n) => n.kind === 'warranty_end')).toBe(false)
    prefs.kinds.warranty_end = true
  })

  it('marks one or all as read', () => {
    const unread = notificationsFor(null, today).filter((n) => !n.read)
    if (unread.length) {
      markRead([unread[0].id], null)
      expect(notificationsFor(null, today).find((n) => n.id === unread[0].id)!.read).toBe(true)
    }
    markRead(undefined, null)
    expect(notificationsFor(null, today).every((n) => n.read)).toBe(true)
  })
})
