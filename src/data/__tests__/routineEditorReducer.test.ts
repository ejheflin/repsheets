import { describe, it, expect } from 'vitest'
import { reduce } from '../routineEditorReducer'
import type { EditableRoutine } from '../../types'

const seed = (): EditableRoutine => ({ program: 'P', routine: 'A', exercises: [
  { id: 'x1', exercise: 'Squat', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
    sets: [{ reps: 3, value: 225, pct: null }] },
  { id: 'x2', exercise: 'Bench', unit: 'lbs', notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
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
  it('duplicateExercise inserts a copy below with a fresh id', () => {
    const s = reduce(seed(), { type: 'duplicateExercise', ex: 0 })
    expect(s.exercises).toHaveLength(3)
    expect(s.exercises[1].exercise).toBe('Squat')          // copy sits right after the source
    expect(s.exercises[2].exercise).toBe('Bench')          // original neighbor pushed down
    expect(s.exercises[1].id).not.toBe(s.exercises[0].id)  // fresh id, not a collision
    expect(s.exercises[1].sets).toEqual(s.exercises[0].sets)
    expect(s.exercises[1].sets).not.toBe(s.exercises[0].sets) // deep-copied, not shared
  })
  it('switching to RPE/RIR/% seeds a default so the mode persists (has a token to serialize)', () => {
    const rpe = reduce(seed(), { type: 'setLoadType', ex: 0, loadType: 'rpe' })
    expect(rpe.exercises[0].loadMode).toBe('rpe')
    expect(rpe.exercises[0].sets.every((s) => s.rpe === 8 && s.value === null && s.pct === null)).toBe(true)

    const rir = reduce(seed(), { type: 'setLoadType', ex: 0, loadType: 'rir' })
    expect(rir.exercises[0].sets.every((s) => s.rir === 2)).toBe(true)

    const pct = reduce(seed(), { type: 'setLoadType', ex: 0, loadType: 'pct' })
    expect(pct.exercises[0].sets.every((s) => s.pct === 80)).toBe(true)
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
  it('setRoutine updates routine name without mutating input', () => {
    const input = seed()
    const s = reduce(input, { type: 'setRoutine', name: 'New Name' })
    expect(s.routine).toBe('New Name')
    expect(input.routine).toBe('A')
    expect(s.program).toBe(input.program)
  })
  it('renameExercise updates the name without mutating input', () => {
    const input = seed()
    const s = reduce(input, { type: 'renameExercise', ex: 0, name: 'Front Squat' })
    expect(s.exercises[0].exercise).toBe('Front Squat')
    expect(input.exercises[0].exercise).toBe('Squat') // input unchanged
  })
  it('setMeasure to time sets unit sec and clears pct on all sets', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const withPct = reduce(grown, { type: 'setUniformLoad', ex: 0, value: null, pct: 75 })
    const s = reduce(withPct, { type: 'setMeasure', ex: 0, measure: 'time' })
    expect(s.exercises[0].unit).toBe('sec')
    expect(s.exercises[0].loadMode).toBe('lb')
    expect(s.exercises[0].sets.every((x) => x.pct === null)).toBe(true)
  })
  it('setMeasure to weight sets unit lbs', () => {
    const s = reduce(seed(), { type: 'setMeasure', ex: 0, measure: 'weight' })
    expect(s.exercises[0].unit).toBe('lbs')
  })
  it('setUnit sets the unit without mutating input', () => {
    const input = seed()
    const s = reduce(input, { type: 'setUnit', ex: 0, unit: 'kg' })
    expect(s.exercises[0].unit).toBe('kg')
    expect(input.exercises[0].unit).toBe('lbs')
  })

  it('setLoadType to rpe sets loadMode rpe, keeps weight unit, clears value/pct/rir', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const withPct = reduce(grown, { type: 'setUniformLoad', ex: 0, value: 200, pct: 80 })
    const s = reduce(withPct, { type: 'setLoadType', ex: 0, loadType: 'rpe' })
    expect(s.exercises[0].loadMode).toBe('rpe')
    expect(s.exercises[0].unit).toBe('lbs')
    expect(s.exercises[0].sets.every((x) => x.value === null && x.pct === null && x.rir === undefined)).toBe(true)
  })
  it('setLoadType to bodyweight sets unit empty and clears all load fields', () => {
    const s = reduce(seed(), { type: 'setLoadType', ex: 0, loadType: 'bodyweight' })
    expect(s.exercises[0].unit).toBe('')
    expect(s.exercises[0].loadMode).toBe('lb')
    expect(s.exercises[0].sets.every((x) => x.value === null && x.pct === null && x.rpe === undefined && x.rir === undefined)).toBe(true)
  })
  it('setLoadType to time sets unit sec', () => {
    const s = reduce(seed(), { type: 'setLoadType', ex: 0, loadType: 'time' })
    expect(s.exercises[0].unit).toBe('sec')
    expect(s.exercises[0].loadMode).toBe('lb')
  })
  it('setLoadType to pct sets loadMode pct and keeps a weight unit', () => {
    const s = reduce(seed(), { type: 'setLoadType', ex: 0, loadType: 'pct' })
    expect(s.exercises[0].loadMode).toBe('pct')
    expect(s.exercises[0].unit).toBe('lbs')
  })

  it('setLoadValue with loadMode rpe sets rpe and nulls value/pct/rir', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const rpeMode = reduce(grown, { type: 'setLoadType', ex: 0, loadType: 'rpe' })
    const s = reduce(rpeMode, { type: 'setLoadValue', ex: 0, value: 8 })
    expect(s.exercises[0].sets.every((x) => x.rpe === 8 && x.value === null && x.pct === null && x.rir === undefined)).toBe(true)
  })
  it('setLoadValue with loadMode lb sets value and nulls the rest', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const s = reduce(grown, { type: 'setLoadValue', ex: 0, value: 185 })
    expect(s.exercises[0].sets.every((x) => x.value === 185 && x.pct === null && x.rpe === undefined && x.rir === undefined)).toBe(true)
  })

  it('setReps single sets reps with no repsMax/repsOpen', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const s = reduce(grown, { type: 'setReps', ex: 0, reps: 8 })
    expect(s.exercises[0].sets.every((x) => x.reps === 8 && x.repsMax === undefined && x.repsOpen === undefined)).toBe(true)
  })
  it('setReps range sets repsMax', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const s = reduce(grown, { type: 'setReps', ex: 0, reps: 8, repsMax: 12 })
    expect(s.exercises[0].sets.every((x) => x.reps === 8 && x.repsMax === 12)).toBe(true)
  })
  it('setReps open sets repsOpen', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const s = reduce(grown, { type: 'setReps', ex: 0, reps: 8, repsOpen: true })
    expect(s.exercises[0].sets.every((x) => x.reps === 8 && x.repsOpen === true)).toBe(true)
  })
  it('setReps does not mutate input', () => {
    const input = seed()
    reduce(input, { type: 'setReps', ex: 0, reps: 99, repsMax: 100 })
    expect(input.exercises[0].sets[0].reps).toBe(3)
    expect(input.exercises[0].sets[0].repsMax).toBeUndefined()
  })

  it('addSet appends a copy of the last set', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 2 })
    const diverged = reduce(grown, { type: 'setPerSet', ex: 0, set: 1, reps: 8, value: 250 })
    const s = reduce(diverged, { type: 'addSet', ex: 0 })
    expect(s.exercises[0].sets).toHaveLength(3)
    expect(s.exercises[0].sets[2]).toEqual({ reps: 8, value: 250, pct: null })
  })
  it('addSet does not mutate input', () => {
    const input = seed()
    reduce(input, { type: 'addSet', ex: 0 })
    expect(input.exercises[0].sets).toHaveLength(1)
  })

  it('removeSet removes the right index', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const diverged = reduce(grown, { type: 'setPerSet', ex: 0, set: 1, reps: 7 })
    const s = reduce(diverged, { type: 'removeSet', ex: 0, set: 1 })
    expect(s.exercises[0].sets).toHaveLength(2)
    expect(s.exercises[0].sets.every((x) => x.reps === 3)).toBe(true)
  })
  it('removeSet will not go below 1 set', () => {
    const s = reduce(seed(), { type: 'removeSet', ex: 0, set: 0 })
    expect(s.exercises[0].sets).toHaveLength(1)
  })
  it('removeSet does not mutate input', () => {
    const input = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    reduce(input, { type: 'removeSet', ex: 0, set: 1 })
    expect(input.exercises[0].sets).toHaveLength(3)
  })

  it('setPerSet sets rpe on a single set without touching others', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const s = reduce(grown, { type: 'setPerSet', ex: 0, set: 1, rpe: 8 })
    expect(s.exercises[0].sets[1].rpe).toBe(8)
    expect(s.exercises[0].sets[0].rpe).toBeUndefined()
    expect(s.exercises[0].sets[2].rpe).toBeUndefined()
  })
  it('setPerSet sets rir on a single set', () => {
    const grown = reduce(seed(), { type: 'setSetCount', ex: 0, count: 3 })
    const s = reduce(grown, { type: 'setPerSet', ex: 0, set: 0, rir: 2 })
    expect(s.exercises[0].sets[0].rir).toBe(2)
    expect(s.exercises[0].sets[1].rir).toBeUndefined()
  })
  it('setPerSet does not mutate input', () => {
    const input = reduce(seed(), { type: 'setSetCount', ex: 0, count: 2 })
    reduce(input, { type: 'setPerSet', ex: 0, set: 0, reps: 99, rpe: 9 })
    expect(input.exercises[0].sets[0].reps).toBe(3)
    expect(input.exercises[0].sets[0].rpe).toBeUndefined()
  })

  it('removeExercise then insertExercise at the same index restores the exercises', () => {
    const input = seed()
    const removed = input.exercises[0]
    const afterRemove = reduce(input, { type: 'removeExercise', ex: 0 })
    expect(afterRemove.exercises).toHaveLength(1)
    expect(afterRemove.exercises[0].exercise).toBe('Bench')
    const restored = reduce(afterRemove, { type: 'insertExercise', index: 0, exercise: removed })
    expect(restored.exercises).toEqual(input.exercises)
  })
  it('insertExercise clamps the index to [0, length]', () => {
    const input = seed()
    const ex = input.exercises[0]
    const s = reduce(input, { type: 'insertExercise', index: 99, exercise: ex })
    expect(s.exercises).toHaveLength(3)
    expect(s.exercises[2].exercise).toBe('Squat')
  })
  it('insertExercise does not mutate input state or the inserted exercise', () => {
    const input = reduce(seed(), { type: 'setSetCount', ex: 0, count: 2 })
    const ex = input.exercises[0]
    const s = reduce(input, { type: 'insertExercise', index: 1, exercise: ex })
    expect(input.exercises).toHaveLength(2)
    // mutating the inserted copy must not affect the source exercise object
    s.exercises[1].sets[0].reps = 999
    expect(ex.sets[0].reps).toBe(3)
  })
})
