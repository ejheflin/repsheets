import { describe, it, expect } from 'vitest'
import { mapRoutineRow } from '../sheets/sheetsApi'

const row = (value: string) => ['P', 'R', 'Squat', '3', '5', value, 'lbs', ''] as string[]

describe('mapRoutineRow value/pct parsing', () => {
  it('keeps integer weights', () => {
    expect(mapRoutineRow(row('225'))).toMatchObject({ value: 225, pct: null })
  })

  it('preserves decimal weights without rounding', () => {
    expect(mapRoutineRow(row('62.5'))).toMatchObject({ value: 62.5, pct: null })
    expect(mapRoutineRow(row('132.5'))).toMatchObject({ value: 132.5, pct: null })
  })

  it('treats explicit % suffix as a percentage', () => {
    expect(mapRoutineRow(row('75%'))).toMatchObject({ value: null, pct: 75 })
    expect(mapRoutineRow(row('87.5%'))).toMatchObject({ value: null, pct: 88 })
  })

  it('treats bare 0-1 decimals as real values, not percentages', () => {
    expect(mapRoutineRow(row('0.75'))).toMatchObject({ value: 0.75, pct: null })
    expect(mapRoutineRow(row('0.5'))).toMatchObject({ value: 0.5, pct: null })
  })

  it('returns nulls for empty or non-numeric values', () => {
    expect(mapRoutineRow(row(''))).toMatchObject({ value: null, pct: null })
    expect(mapRoutineRow(row('bodyweight'))).toMatchObject({ value: null, pct: null })
  })

  it('fills remaining columns with defaults', () => {
    const parsed = mapRoutineRow(['P', 'R', 'Squat'] as string[])
    expect(parsed).toMatchObject({ sets: '1', reps: null, value: null, pct: null, unit: '', notes: '' })
  })
})
