import type { LifecycleRecord } from '@/entities/types'
import { historySteps } from './history'

const line = (status: string, number: string): LifecycleRecord => ({
  id: number,
  productId: 'p',
  at: '2026-07-30T07:32:00',
  lifecycle: null,
  status,
  document: { kind: 'release', number },
  author: null,
})

describe('historySteps', () => {
  it('folds a run of one status into one step and keeps every change', () => {
    const steps = historySteps([
      line('Создано', '1'),
      line('На складе', '2'),
      line('На складе', '3'),
      line('На складе', '4'),
      line('Отгружен', '4'),
      line('На складе', '5'),
    ])
    expect(steps.map((s) => [s.first.status, s.first.document.number, s.count])).toEqual([
      ['Создано', '1', 1],
      ['На складе', '2', 3],
      ['Отгружен', '4', 1],
      ['На складе', '5', 1],
    ])
  })
})
