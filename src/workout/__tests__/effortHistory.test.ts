import { describe, it, expect } from 'vitest'
import { lastWeightAtEffort } from '../effortHistory'
import type { LogEntry } from '../../types'

const log = (over: Partial<LogEntry>): LogEntry => ({
  date: '2026-01-01', athlete: 'me', program: 'P', routine: 'A', exercise: 'Bench',
  set: 1, reps: 5, value: 100, unit: 'lbs', notes: '', pct: null,
  achievedRpe: null, achievedRir: null, ...over,
})

describe('lastWeightAtEffort', () => {
  it('returns the most recent weight logged at the same RPE and reps', () => {
    const logs = [
      log({ date: '2026-01-01', value: 185, reps: 5, achievedRpe: 8 }),
      log({ date: '2026-01-08', value: 190, reps: 5, achievedRpe: 8 }),
      log({ date: '2026-01-15', value: 195, reps: 5, achievedRpe: 9 }), // different effort
    ]
    expect(lastWeightAtEffort(logs, 'Bench', 'me', 5, 8)).toBe(190)
  })

  it('matches RIR-logged history to an RPE target (2 RIR = RPE 8)', () => {
    const logs = [log({ date: '2026-02-01', value: 205, reps: 5, achievedRir: 2 })]
    expect(lastWeightAtEffort(logs, 'Bench', 'me', 5, 8)).toBe(205)
  })

  it('prefers the same rep count, but falls back to any reps at that effort', () => {
    const logs = [
      log({ date: '2026-01-01', value: 225, reps: 3, achievedRpe: 8 }),
      log({ date: '2026-01-10', value: 185, reps: 8, achievedRpe: 8 }),
    ]
    expect(lastWeightAtEffort(logs, 'Bench', 'me', 5, 8)).toBe(185) // most recent, no exact-reps match
    expect(lastWeightAtEffort(logs, 'Bench', 'me', 3, 8)).toBe(225) // exact reps wins
  })

  it('ignores other exercises and athletes', () => {
    const logs = [
      log({ exercise: 'Squat', value: 300, achievedRpe: 8 }),
      log({ athlete: 'you', value: 400, achievedRpe: 8 }),
    ]
    expect(lastWeightAtEffort(logs, 'Bench', 'me', 5, 8)).toBeNull()
  })

  it('returns null when no effort was recorded', () => {
    const logs = [log({ value: 185, reps: 5, achievedRpe: null, achievedRir: null })]
    expect(lastWeightAtEffort(logs, 'Bench', 'me', 5, 8)).toBeNull()
  })
})
