import { describe, it, expect } from 'vitest'
import { serializeAchieved, parseAchieved } from '../achievedRpe'

describe('serializeAchieved', () => {
  it('appends an RPE token to notes', () => {
    expect(serializeAchieved('felt strong', 8)).toBe('felt strong @8')
  })

  it('appends a RIR token to notes', () => {
    expect(serializeAchieved('grindy', null, 2)).toBe('grindy 2RIR')
  })

  it('emits the token alone when there are no notes', () => {
    expect(serializeAchieved('', 9)).toBe('@9')
    expect(serializeAchieved('   ', null, 1)).toBe('1RIR')
  })

  it('returns just the notes when no RPE/RIR given', () => {
    expect(serializeAchieved('back tweak', null, null)).toBe('back tweak')
    expect(serializeAchieved('back tweak')).toBe('back tweak')
  })

  it('prefers RPE over RIR when both supplied', () => {
    expect(serializeAchieved('x', 7, 3)).toBe('x @7')
  })

  it('preserves half-step RPE', () => {
    expect(serializeAchieved('top set', 8.5)).toBe('top set @8.5')
  })
})

describe('parseAchieved', () => {
  it('extracts a trailing RPE token and cleans notes', () => {
    expect(parseAchieved('felt strong @8')).toEqual({ notes: 'felt strong', rpe: 8, rir: null })
  })

  it('extracts a trailing RIR token (case-insensitive)', () => {
    expect(parseAchieved('grindy 2rir')).toEqual({ notes: 'grindy', rpe: null, rir: 2 })
  })

  it('handles a token with no surrounding notes', () => {
    expect(parseAchieved('@9')).toEqual({ notes: '', rpe: 9, rir: null })
    expect(parseAchieved('1RIR')).toEqual({ notes: '', rpe: null, rir: 1 })
  })

  it('returns plain notes when there is no token', () => {
    expect(parseAchieved('back tweak')).toEqual({ notes: 'back tweak', rpe: null, rir: null })
  })

  it('parses half-step RPE', () => {
    expect(parseAchieved('@8.5')).toEqual({ notes: '', rpe: 8.5, rir: null })
  })

  it('round-trips with serializeAchieved', () => {
    const notes = 'paused reps'
    const s = serializeAchieved(notes, 7.5)
    expect(parseAchieved(s)).toEqual({ notes, rpe: 7.5, rir: null })
  })

  it('does not mistake a bare trailing number for a token', () => {
    expect(parseAchieved('set of 5')).toEqual({ notes: 'set of 5', rpe: null, rir: null })
  })
})
