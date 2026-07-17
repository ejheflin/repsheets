import { describe, it, expect } from 'vitest'
import { toEditable, toRows } from '../routineModel'
import type { RoutineRow, EditableRoutine } from '../../types'

const base = (o: Partial<RoutineRow>): RoutineRow => ({
  program: 'P', routine: 'D', exercise: 'Squat', sets: '5', reps: 5,
  value: 225, pct: null, unit: 'lbs', notes: '', ...o,
})

describe('duplicate exercise names (round-trip safety)', () => {
  it('adjacent duplicated exercise keeps all sets across a round-trip', () => {
    // swipe-Duplicate creates a second card with the same name; serialization
    // must continue the cumulative count ("3","6"), not restart ("3","3")
    const ed: EditableRoutine = {
      program: 'P', routine: 'D',
      exercises: [
        { id: 'a', exercise: 'Squat', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
          sets: [{ reps: 5, value: 225, pct: null }, { reps: 5, value: 225, pct: null }, { reps: 5, value: 225, pct: null }] },
        { id: 'b', exercise: 'Squat', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
          sets: [{ reps: 5, value: 225, pct: null }, { reps: 5, value: 225, pct: null }, { reps: 5, value: 225, pct: null }] },
      ],
    }
    const rows = toRows(ed)
    expect(rows.map((r) => r.sets)).toEqual(['3', '6'])
    const back = toEditable(rows)
    const totalSets = back.exercises.reduce((n, ex) => n + ex.sets.length, 0)
    expect(totalSets).toBe(6)
    // identical sets canonicalize to one "6" row — still 6 sets, stable from here on
    const again = toEditable(toRows(back))
    expect(again.exercises.reduce((n, ex) => n + ex.sets.length, 0)).toBe(6)
  })

  it('duplicated exercise with edited loads round-trips exactly', () => {
    const ed: EditableRoutine = {
      program: 'P', routine: 'D',
      exercises: [
        { id: 'a', exercise: 'Squat', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
          sets: [{ reps: 5, value: 315, pct: null }, { reps: 5, value: 315, pct: null }, { reps: 5, value: 315, pct: null }] },
        { id: 'b', exercise: 'Squat', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
          sets: [{ reps: 8, value: 225, pct: null }, { reps: 8, value: 225, pct: null }, { reps: 8, value: 225, pct: null }] },
      ],
    }
    const rows = toRows(ed)
    expect(rows.map((r) => r.sets)).toEqual(['3', '6'])
    const back = toEditable(rows)
    expect(back.exercises.reduce((n, ex) => n + ex.sets.length, 0)).toBe(6)
    expect(back.exercises[0].sets.filter((s) => s.value === 315)).toHaveLength(3)
    expect(back.exercises[0].sets.filter((s) => s.value === 225)).toHaveLength(3)
    expect(toRows(back)).toEqual(rows)
  })

  it('non-adjacent same-name blocks are not merged (Squat / Bench / Squat-backoff)', () => {
    const rows = [
      base({ exercise: 'Squat', sets: '3', value: 315 }),
      base({ exercise: 'Bench', sets: '3', value: 225 }),
      base({ exercise: 'Squat', sets: '3', value: 225 }),
    ]
    const ed = toEditable(rows)
    expect(ed.exercises.map((e) => e.exercise)).toEqual(['Squat', 'Bench', 'Squat'])
    expect(ed.exercises.reduce((n, ex) => n + ex.sets.length, 0)).toBe(9)
    // the backoff block's distinct weight survives
    expect(ed.exercises[2].sets[0].value).toBe(225)
    expect(toRows(ed)).toEqual(rows)
  })
})

describe('RPE/RIR load mode detection', () => {
  it('an RPE-prescribed exercise loads in rpe mode, not weight mode', () => {
    const rows = [base({ exercise: 'Squat', sets: '3', value: null, rpe: 8 })]
    const ed = toEditable(rows)
    expect(ed.exercises[0].loadMode).toBe('rpe')
    expect(ed.exercises[0].sets[0].rpe).toBe(8)
  })

  it('a RIR-prescribed exercise loads in rir mode', () => {
    const rows = [base({ exercise: 'Squat', sets: '3', value: null, rir: 2 })]
    const ed = toEditable(rows)
    expect(ed.exercises[0].loadMode).toBe('rir')
  })
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
  it('rep range round-trips', () => {
    const rows = [base({ exercise: 'Bench', sets: '3', reps: 8, repsMax: 12 })]
    const ed = toEditable(rows); expect(ed.exercises[0].sets[0].repsMax).toBe(12)
    expect(toRows(ed)).toEqual(rows)
  })
  it('omits blank-named exercises from toRows', () => {
    const ed: EditableRoutine = { program: 'P', routine: 'D', exercises: [
      { id: 'x1', exercise: '', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null, sets: [{ reps: 5, value: 100, pct: null }] },
      { id: 'x2', exercise: 'Squat', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null, sets: [{ reps: 5, value: 225, pct: null }] },
    ] }
    const rows = toRows(ed)
    expect(rows.every((r) => r.exercise.trim() !== '')).toBe(true)
    expect(rows.map((r) => r.exercise)).toEqual(['Squat'])
  })
})
