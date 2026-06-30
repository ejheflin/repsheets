import { describe, it, expect } from 'vitest'
import { replaceRoutineInRows, deleteRoutineInRows, renameProgramInRows, deleteProgramInRows } from '../driveApi'
import type { RoutineRow } from '../../types'
const r = (o: Partial<RoutineRow>): RoutineRow => ({
  program: 'P', routine: 'A', exercise: 'X', sets: '5', reps: 5, value: 225,
  pct: null, unit: 'lbs', notes: '', ...o })

describe('row transforms', () => {
  it('replaces only the target routine, keeps others in place', () => {
    const all = [r({ routine: 'A', exercise: 'X' }), r({ routine: 'B', exercise: 'Y' })]
    const out = replaceRoutineInRows(all, 'P', 'A', [r({ routine: 'A', exercise: 'Z' })])
    expect(out.map((x) => x.exercise)).toEqual(['Z', 'Y'])
  })
  it('appends when routine does not exist yet', () => {
    const all = [r({ routine: 'B', exercise: 'Y' })]
    const out = replaceRoutineInRows(all, 'P', 'A', [r({ routine: 'A', exercise: 'Z' })])
    expect(out.map((x) => x.routine)).toEqual(['B', 'A'])
  })
  it('deletes only matching rows', () => {
    const all = [r({ routine: 'A' }), r({ routine: 'B' })]
    expect(deleteRoutineInRows(all, 'P', 'A').map((x) => x.routine)).toEqual(['B'])
  })
  it('renames program on matching rows only', () => {
    const all = [r({ program: 'P' }), r({ program: 'Q' })]
    expect(renameProgramInRows(all, 'P', 'P2').map((x) => x.program)).toEqual(['P2', 'Q'])
  })
  it('deletes all rows of a program, keeps other programs', () => {
    const all = [r({ program: 'P', routine: 'A' }), r({ program: 'P', routine: 'B' }), r({ program: 'Q', routine: 'A' })]
    const out = deleteProgramInRows(all, 'P')
    expect(out.map((x) => x.program)).toEqual(['Q'])
  })
})
