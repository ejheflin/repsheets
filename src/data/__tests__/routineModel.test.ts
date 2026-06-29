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
  it('multi-row fill-up exercise round-trips', () => {
    const rows = [
      base({ exercise: 'Squat', sets: '5',  reps: 5, value: 225 }),
      base({ exercise: 'Squat', sets: '10', reps: 5, value: 185 }),
    ]
    const ed = toEditable(rows)
    expect(ed.exercises).toHaveLength(1)
    expect(ed.exercises[0].sets).toHaveLength(10)
    expect(ed.exercises[0].sets[0].value).toBe(225)
    expect(ed.exercises[0].sets[5].value).toBe(185)
    expect(toRows(ed)).toEqual(rows)
  })
  it('rpe survives round-trip', () => {
    const rows = [base({ exercise: 'Bench', sets: '3', reps: 5, value: null, pct: 75, basis: '1rm', rpe: 8 })]
    const ed = toEditable(rows)
    expect(ed.exercises[0].sets[0].rpe).toBe(8)
    expect(toRows(ed)).toEqual(rows)
  })
})
