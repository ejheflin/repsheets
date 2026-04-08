import { describe, it, expect } from 'vitest'
import { resolveSetValues } from '../workout/autofill'
import type { ExpandedSet, LogEntry } from '../types'

const ATHLETE = 'test@gmail.com'

function makeSet(overrides: Partial<ExpandedSet> = {}): ExpandedSet {
  return {
    exercise: 'Bench Press',
    setNumber: 1,
    reps: 5,
    value: 225,
    unit: 'lbs',
    notes: '',
    supersetGroup: null,
    ...overrides,
  }
}

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    date: '2026-04-07',
    athlete: ATHLETE,
    program: 'Test',
    routine: 'Day1',
    exercise: 'Bench Press',
    set: 1,
    reps: 6,
    value: 230,
    unit: 'lbs',
    notes: '',
    ...overrides,
  }
}

describe('resolveSetValues', () => {
  it('returns log values when log history exists', () => {
    const set = makeSet({ reps: 5, value: 225 })
    const logs = [makeLog({ reps: 6, value: 230 })]
    const result = resolveSetValues(set, logs, 'Test', 'Day1', ATHLETE)
    expect(result.reps).toBe(6)
    expect(result.value).toBe(230)
  })

  it('returns last matching log entry (append-order = most recent)', () => {
    const set = makeSet()
    const logs = [
      makeLog({ date: '2026-04-05', reps: 4, value: 215 }),
      makeLog({ date: '2026-04-06', reps: 5, value: 220 }),
      makeLog({ date: '2026-04-07', reps: 6, value: 230 }),
    ]
    const result = resolveSetValues(set, logs, 'Test', 'Day1', ATHLETE)
    expect(result.reps).toBe(6)
    expect(result.value).toBe(230)
  })

  it('handles multiple workouts on the same date (last entry wins)', () => {
    const set = makeSet()
    const logs = [
      makeLog({ date: '2026-04-07', reps: 5, value: 225 }),
      makeLog({ date: '2026-04-07', reps: 4, value: 225 }),
    ]
    const result = resolveSetValues(set, logs, 'Test', 'Day1', ATHLETE)
    expect(result.reps).toBe(4)
    expect(result.value).toBe(225)
  })

  it('falls back to routine config when no log history', () => {
    const set = makeSet({ reps: 5, value: 225 })
    const result = resolveSetValues(set, [], 'Test', 'Day1', ATHLETE)
    expect(result.reps).toBe(5)
    expect(result.value).toBe(225)
  })

  it('returns nulls when both sources are blank', () => {
    const set = makeSet({ reps: null, value: null })
    const result = resolveSetValues(set, [], 'Test', 'Day1', ATHLETE)
    expect(result.reps).toBeNull()
    expect(result.value).toBeNull()
  })

  it('matches by exercise and set number', () => {
    const set = makeSet({ exercise: 'OHP', setNumber: 2 })
    const logs = [
      makeLog({ exercise: 'Bench Press', set: 2, reps: 10 }),
      makeLog({ exercise: 'OHP', set: 1, reps: 8 }),
      makeLog({ exercise: 'OHP', set: 2, reps: 7, value: 135 }),
    ]
    const result = resolveSetValues(set, logs, 'Test', 'Day1', ATHLETE)
    expect(result.reps).toBe(7)
    expect(result.value).toBe(135)
  })

  it('matches by program and routine', () => {
    const set = makeSet({ setNumber: 1 })
    const logs = [
      makeLog({ program: 'Other', routine: 'Day1', reps: 99 }),
      makeLog({ program: 'Test', routine: 'Day2', reps: 88 }),
      makeLog({ program: 'Test', routine: 'Day1', reps: 6, value: 230 }),
    ]
    const result = resolveSetValues(set, logs, 'Test', 'Day1', ATHLETE)
    expect(result.reps).toBe(6)
  })

  it('only returns values for the current athlete', () => {
    const set = makeSet()
    const logs = [
      makeLog({ athlete: 'coach@gmail.com', reps: 10, value: 315 }),
      makeLog({ athlete: ATHLETE, reps: 5, value: 225 }),
      makeLog({ athlete: 'other@gmail.com', reps: 8, value: 275 }),
    ]
    const result = resolveSetValues(set, logs, 'Test', 'Day1', ATHLETE)
    expect(result.reps).toBe(5)
    expect(result.value).toBe(225)
  })

  it('falls back to config when only other athletes have history', () => {
    const set = makeSet({ reps: 5, value: 225 })
    const logs = [
      makeLog({ athlete: 'coach@gmail.com', reps: 10, value: 315 }),
    ]
    const result = resolveSetValues(set, logs, 'Test', 'Day1', ATHLETE)
    expect(result.reps).toBe(5)
    expect(result.value).toBe(225)
  })
})
