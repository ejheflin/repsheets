import { describe, it, expect } from 'vitest'
import { rpeToRir, rirToRpe, rpeToPct, rirToPct, e1rmFromRpe, suggestWeight } from '../rpe'

describe('rpe/rir conversion', () => {
  it('converts', () => { expect(rpeToRir(8)).toBe(2); expect(rirToRpe(2)).toBe(8) })
})

describe('rpeToPct', () => {
  it('matches the chart', () => {
    expect(rpeToPct(5, 8)).toBeCloseTo(0.81, 2)
    expect(rpeToPct(5, 7)).toBeCloseTo(0.79, 2)
    expect(rpeToPct(1, 10)).toBeCloseTo(1.0, 2)
    expect(rpeToPct(3, 9)).toBeCloseTo(0.89, 2)
  })
  it('clamps out-of-range reps/rpe to table edges', () => {
    expect(rpeToPct(12, 8)).toBeCloseTo(0.74, 2) // reps clamp to 8
    expect(rpeToPct(5, 5)).toBeCloseTo(0.77, 2)  // rpe clamp to 6.5
  })
  it('rounds rpe to nearest 0.5', () => {
    expect(rpeToPct(5, 8.2)).toBeCloseTo(0.81, 2) // -> RPE 8
  })
})

describe('rirToPct', () => {
  it('2 RIR at 5 reps == RPE 8 at 5 reps', () => expect(rirToPct(5, 2)).toBeCloseTo(rpeToPct(5, 8), 5))
})

describe('e1rmFromRpe', () => {
  it('225x5 @ RPE8 -> ~278', () => expect(e1rmFromRpe(225, 5, 8)).toBeGreaterThan(275) )
  it('225x5 @ RPE8 -> ~278 upper', () => expect(e1rmFromRpe(225, 5, 8)).toBeLessThan(281) )
})

describe('suggestWeight', () => {
  it('RPE7x5 from e1rm 278 -> ~220 (rounded to 5)', () => {
    const w = suggestWeight(5, 7, 278)
    expect(w % 5).toBe(0)
    expect(w).toBeGreaterThanOrEqual(215)
    expect(w).toBeLessThanOrEqual(225)
  })
  it('kg step 2.5', () => { expect(suggestWeight(5, 7, 126, 2.5) % 2.5).toBe(0) })
})
