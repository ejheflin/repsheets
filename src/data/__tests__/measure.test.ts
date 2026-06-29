import { describe, it, expect } from 'vitest'
import { measureOf, formatDuration, formatValue, MEASURES } from '../measure'

describe('measureOf', () => {
  it('weight units', () => { expect(measureOf('lbs')).toBe('weight'); expect(measureOf('KG')).toBe('weight') })
  it('time', () => expect(measureOf('sec')).toBe('time'))
  it('distance', () => { expect(measureOf('m')).toBe('distance'); expect(measureOf('Mi')).toBe('distance') })
  it('blank/unknown → reps', () => { expect(measureOf('')).toBe('reps'); expect(measureOf(null)).toBe('reps'); expect(measureOf('bananas')).toBe('reps') })
})

describe('formatDuration', () => {
  it('formats m:ss', () => {
    expect(formatDuration(45)).toBe('0:45')
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(605)).toBe('10:05')
  })
})

describe('formatValue', () => {
  it('null → empty', () => expect(formatValue(null, 'lbs')).toBe(''))
  it('weight', () => expect(formatValue(225, 'lbs')).toBe('225 lbs'))
  it('distance', () => expect(formatValue(400, 'm')).toBe('400 m'))
  it('time', () => expect(formatValue(45, 'sec')).toBe('0:45'))
  it('reps (blank unit) → bare number', () => expect(formatValue(8, '')).toBe('8'))
})

describe('MEASURES config', () => {
  it('only weight supports percent', () => {
    expect(MEASURES.weight.supportsPercent).toBe(true)
    expect(MEASURES.reps.supportsPercent).toBe(false)
    expect(MEASURES.time.supportsPercent).toBe(false)
    expect(MEASURES.distance.supportsPercent).toBe(false)
  })
  it('default units', () => {
    expect(MEASURES.weight.defaultUnit).toBe('lbs')
    expect(MEASURES.time.defaultUnit).toBe('sec')
    expect(MEASURES.distance.defaultUnit).toBe('m')
  })
})
