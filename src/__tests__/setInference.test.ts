import { describe, it, expect } from 'vitest'
import { expandRoutine } from '../workout/setInference'
import type { RoutineRow } from '../types'

function row(overrides: Partial<RoutineRow> = {}): RoutineRow {
  return {
    program: 'Test',
    routine: 'Day1',
    exercise: 'Bench Press',
    sets: '3',
    reps: 5,
    value: 225,
    unit: 'lbs',
    notes: '',
    ...overrides,
  }
}

describe('expandRoutine', () => {
  it('expands a single row with Sets=3 into 3 sets', () => {
    const result = expandRoutine([row({ sets: '3' })])
    expect(result).toHaveLength(3)
    expect(result.map(s => s.setNumber)).toEqual([1, 2, 3])
    expect(result.every(s => s.reps === 5 && s.value === 225)).toBe(true)
    expect(result.every(s => s.supersetGroup === null)).toBe(true)
  })

  it('expands Sets=1 into a single set', () => {
    const result = expandRoutine([row({ sets: '1' })])
    expect(result).toHaveLength(1)
    expect(result[0].setNumber).toBe(1)
  })

  it('handles fill-up: Sets=5 then Sets=10 for same exercise', () => {
    const rows = [
      row({ sets: '5', value: 225 }),
      row({ sets: '10', value: 185 }),
    ]
    const result = expandRoutine(rows)
    expect(result).toHaveLength(10)
    for (let i = 0; i < 5; i++) {
      expect(result[i].setNumber).toBe(i + 1)
      expect(result[i].value).toBe(225)
    }
    for (let i = 5; i < 10; i++) {
      expect(result[i].setNumber).toBe(i + 1)
      expect(result[i].value).toBe(185)
    }
  })

  it('detects superset group from trailing letter', () => {
    const rows = [
      row({ exercise: 'Bench Press', sets: '3a' }),
      row({ exercise: 'OHP', sets: '4a' }),
    ]
    const result = expandRoutine(rows)
    const bench = result.filter(s => s.exercise === 'Bench Press')
    const ohp = result.filter(s => s.exercise === 'OHP')
    expect(bench).toHaveLength(3)
    expect(ohp).toHaveLength(4)
    expect(bench.every(s => s.supersetGroup === 'a')).toBe(true)
    expect(ohp.every(s => s.supersetGroup === 'a')).toBe(true)
  })

  it('handles multiple exercises without supersets', () => {
    const rows = [
      row({ exercise: 'Bench Press', sets: '5', reps: 5, value: 225 }),
      row({ exercise: 'OHP', sets: '3', reps: 8, value: 135 }),
    ]
    const result = expandRoutine(rows)
    const bench = result.filter(s => s.exercise === 'Bench Press')
    const ohp = result.filter(s => s.exercise === 'OHP')
    expect(bench).toHaveLength(5)
    expect(ohp).toHaveLength(3)
    expect(bench.every(s => s.supersetGroup === null)).toBe(true)
  })

  it('handles blank reps and value', () => {
    const result = expandRoutine([row({ sets: '3', reps: null, value: null })])
    expect(result).toHaveLength(3)
    expect(result.every(s => s.reps === null && s.value === null)).toBe(true)
  })

  it('preserves notes from routine config', () => {
    const result = expandRoutine([row({ sets: '2', notes: 'last set to failure' })])
    expect(result.every(s => s.notes === 'last set to failure')).toBe(true)
  })

  it('handles mixed superset and non-superset exercises', () => {
    const rows = [
      row({ exercise: 'Bench', sets: '3a' }),
      row({ exercise: 'OHP', sets: '3a' }),
      row({ exercise: 'Lateral Raise', sets: '3' }),
    ]
    const result = expandRoutine(rows)
    const bench = result.filter(s => s.exercise === 'Bench')
    const ohp = result.filter(s => s.exercise === 'OHP')
    const lr = result.filter(s => s.exercise === 'Lateral Raise')
    expect(bench.every(s => s.supersetGroup === 'a')).toBe(true)
    expect(ohp.every(s => s.supersetGroup === 'a')).toBe(true)
    expect(lr.every(s => s.supersetGroup === null)).toBe(true)
  })
})
