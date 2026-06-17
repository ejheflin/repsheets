import { describe, it, expect } from 'vitest'
import { toEditable, toRows } from '../routineModel'
import type { RoutineRow } from '../../types'

const base = (o: Partial<RoutineRow>): RoutineRow => ({
  program: 'P', routine: 'D', exercise: 'Squat', sets: '5', reps: 5,
  value: 225, pct: null, unit: 'lbs', notes: '', ...o,
})

describe('toEditable / toRows', () => {
  it('uniform exercise round-trips', () => {
    const rows = [base({ exercise: 'Squat', sets: '5', reps: 5, value: 225 })]
    const ed = toEditable(rows)
    expect(ed.exercises[0].sets).toHaveLength(5)
    expect(ed.exercises[0].loadMode).toBe('lb')
    expect(toRows(ed)).toEqual(rows)
  })
  it('pct exercise carries basis and loadMode', () => {
    const rows = [base({ exercise: 'Bench', sets: '5', reps: 5, value: null, pct: 80, basis: 'tm' })]
    const ed = toEditable(rows)
    expect(ed.exercises[0].loadMode).toBe('pct')
    expect(ed.exercises[0].basis).toBe('tm')
    expect(toRows(ed)).toEqual(rows)
  })
  it('superset group from shared letter', () => {
    const rows = [
      base({ exercise: 'Bench', sets: '3a' }),
      base({ exercise: 'Row', sets: '3a' }),
    ]
    const ed = toEditable(rows)
    expect(ed.exercises[0].supersetGroup).toBe('a')
    expect(ed.exercises[1].supersetGroup).toBe('a')
    expect(toRows(ed)).toEqual(rows)
  })
})
