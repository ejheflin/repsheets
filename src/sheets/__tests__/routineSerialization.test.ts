import { describe, it, expect } from 'vitest'
import { parseRoutineValue, serializeRoutineValue } from '../routineSerialization'
import { parseSets, serializeSets } from '../routineSerialization'

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
  it('null and undefined inputs → null', () => {
    expect(parseRoutineValue(null)).toEqual({ value: null, pct: null, basis: null })
    expect(parseRoutineValue(undefined)).toEqual({ value: null, pct: null, basis: null })
  })
  it('negative numbers → null', () => {
    expect(parseRoutineValue('-100')).toEqual({ value: null, pct: null, basis: null })
  })
  it('bare percent sign → null', () => {
    expect(parseRoutineValue('%')).toEqual({ value: null, pct: null, basis: null })
  })
  it('both 1RM and TM keywords present → TM wins', () => {
    expect(parseRoutineValue('80% 1RM TM')).toEqual({ value: null, pct: 80, basis: 'tm' })
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

describe('parseSets', () => {
  it('plain count', () => expect(parseSets('10')).toEqual({ count: 10, group: null }))
  it('superset letter', () => {
    expect(parseSets('3a')).toEqual({ count: 3, group: 'a' })
    expect(parseSets('3A')).toEqual({ count: 3, group: 'a' })
  })
  it('blank/garbage defaults to 1 set, no group', () => {
    expect(parseSets('')).toEqual({ count: 1, group: null })
    expect(parseSets('xx')).toEqual({ count: 1, group: null })
  })
})

describe('serializeSets', () => {
  it('with and without group', () => {
    expect(serializeSets(3, 'a')).toBe('3a')
    expect(serializeSets(10, null)).toBe('10')
  })
  it('clamps to >= 1', () => expect(serializeSets(0, null)).toBe('1'))
})

describe('round-trip', () => {
  it('80% TM survives read->write', () => {
    const parsed = parseRoutineValue('80% TM')
    expect(serializeRoutineValue(parsed)).toBe('80% TM')
  })
  it('225 survives', () => expect(serializeRoutineValue(parseRoutineValue('225'))).toBe('225'))
})

describe('RPE/RIR token', () => {
  it('parses pure RPE', () => expect(parseRoutineValue('@8')).toEqual({ value: null, pct: null, basis: null, rpe: 8 }))
  it('parses half-point RPE', () => expect(parseRoutineValue('@8.5')).toEqual({ value: null, pct: null, basis: null, rpe: 8.5 }))
  it('parses pct + RPE', () => expect(parseRoutineValue('75% @8')).toEqual({ value: null, pct: 75, basis: '1rm', rpe: 8 }))
  it('parses TM + RPE', () => expect(parseRoutineValue('80% TM @8')).toEqual({ value: null, pct: 80, basis: 'tm', rpe: 8 }))
  it('parses RIR variants, number belongs to RIR not load', () => {
    expect(parseRoutineValue('2RIR')).toEqual({ value: null, pct: null, basis: null, rir: 2 })
    expect(parseRoutineValue('2 rir')).toEqual({ value: null, pct: null, basis: null, rir: 2 })
  })
  it('parses load + RPE (log form)', () => expect(parseRoutineValue('185 @8')).toEqual({ value: 185, pct: null, basis: null, rpe: 8 }))
  it('plain load has no rpe/rir', () => expect(parseRoutineValue('225')).toEqual({ value: 225, pct: null, basis: null }))
})

describe('serialize RPE/RIR', () => {
  it('pct + rpe', () => expect(serializeRoutineValue({ value: null, pct: 75, basis: '1rm', rpe: 8 })).toBe('75% @8'))
  it('pure rpe', () => expect(serializeRoutineValue({ value: null, pct: null, rpe: 8 })).toBe('@8'))
  it('load + rpe', () => expect(serializeRoutineValue({ value: 185, pct: null, rpe: 8 })).toBe('185 @8'))
  it('rir', () => expect(serializeRoutineValue({ value: null, pct: null, rir: 2 })).toBe('2 RIR'))
  it('plain load unchanged', () => expect(serializeRoutineValue({ value: 225, pct: null })).toBe('225'))
})
