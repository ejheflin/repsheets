import { describe, it, expect } from 'vitest'
import { reduce } from '../routineEditorReducer'
import type { EditableRoutine } from '../../types'

const seed = (): EditableRoutine => ({ program: 'P', routine: 'A', exercises: [
  { exercise: 'Squat', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
    sets: [{ reps: 3, value: 225, pct: null }] },
  { exercise: 'Bench', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
    sets: [{ reps: 5, value: 135, pct: null }] },
] })

describe('reduce', () => {
  it('growing set count inherits the last set', () => {
    const s = reduce(seed(), { type: 'setSetCount', ex: 0, count: 10 })
    expect(s.exercises[0].sets).toHaveLength(10)
    expect(s.exercises[0].sets.every((x) => x.reps === 3 && x.value === 225)).toBe(true)
  })
  it('shrinking truncates, min 1', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 5 })
    const s = reduce(grown, { type: 'setSetCount', ex: 0, count: 0 })
    expect(s.exercises[0].sets).toHaveLength(1)
  })
  it('uniform reps applies to all', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const s = reduce(grown, { type: 'setUniformReps', ex: 0, reps: 5 })
    expect(s.exercises[0].sets.every((x) => x.reps === 5)).toBe(true)
  })
  it('does not mutate input state', () => {
    const input = seed()
    reduce(input, { type: 'setUniformReps', ex: 0, reps: 99 })
    expect(input.exercises[0].sets[0].reps).toBe(3)
  })
  it('groupWithNext assigns a shared letter to adjacent exercises', () => {
    const s = reduce(seed(), { type: 'groupWithNext', ex: 0 })
    expect(s.exercises[0].supersetGroup).toBe('a')
    expect(s.exercises[1].supersetGroup).toBe('a')
  })
  it('groupWithNext on last exercise is a no-op', () => {
    const s = reduce(seed(), { type: 'groupWithNext', ex: 1 })
    expect(s.exercises[1].supersetGroup).toBeNull()
  })
  it('ungroup clears the letter', () => {
    const grouped = reduce(seed(), { type: 'groupWithNext', ex: 0 })
    const s = reduce(grouped, { type: 'ungroup', ex: 0 })
    expect(s.exercises[0].supersetGroup).toBeNull()
  })
})
