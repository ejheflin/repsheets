import { describe, it, expect } from 'vitest'
import { parseRoutineValue, serializeRoutineValue } from '../routineSerialization'

describe('parseRoutineValue', () => {
  it('absolute weight', () => {
    expect(parseRoutineValue('225')).toEqual({ value: 225, pct: null, basis: null })
    expect(parseRoutineValue('135.5')).toEqual({ value: 136, pct: null, basis: null })
  })
  it('decimal percentage heuristic → 1RM', () => {
    expect(parseRoutineValue('0.8')).toEqual({ value: null, pct: 80, basis: '1rm' })
  })
  it('percent of 1RM, spacing tolerated', () => {
    expect(parseRoutineValue('80%')).toEqual({ value: null, pct: 80, basis: '1rm' })
    expect(parseRoutineValue('80 %')).toEqual({ value: null, pct: 80, basis: '1rm' })
    expect(parseRoutineValue('80%1RM')).toEqual({ value: null, pct: 80, basis: '1rm' })
    expect(parseRoutineValue('80% 1rm')).toEqual({ value: null, pct: 80, basis: '1rm' })
  })
  it('percent of training max, any spacing/case', () => {
    for (const s of ['80%TM', '80% TM', '80 % tm', '80%Tm']) {
      expect(parseRoutineValue(s)).toEqual({ value: null, pct: 80, basis: 'tm' })
    }
  })
  it('keyword implies percent without %', () => {
    expect(parseRoutineValue('80TM')).toEqual({ value: null, pct: 80, basis: 'tm' })
    expect(parseRoutineValue('80 1RM')).toEqual({ value: null, pct: 80, basis: '1rm' })
  })
  it('empty / unrecognized → null', () => {
    expect(parseRoutineValue('')).toEqual({ value: null, pct: null, basis: null })
    expect(parseRoutineValue('heavy')).toEqual({ value: null, pct: null, basis: null })
  })
})

describe('serializeRoutineValue', () => {
  it('canonical forms', () => {
    expect(serializeRoutineValue({ value: null, pct: 80, basis: '1rm' })).toBe('80%')
    expect(serializeRoutineValue({ value: null, pct: 80, basis: 'tm' })).toBe('80% TM')
    expect(serializeRoutineValue({ value: 225, pct: null })).toBe('225')
    expect(serializeRoutineValue({ value: null, pct: null })).toBe('')
  })
  it('pct without basis defaults to 1RM (bare %)', () => {
    expect(serializeRoutineValue({ value: null, pct: 80 })).toBe('80%')
  })
})
