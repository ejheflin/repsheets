import { describe, it, expect } from 'vitest'
import {
  replaceRoutineInRows,
  deleteRoutineInRows,
  renameProgramInRows,
  deleteProgramInRows,
  reorderProgramRoutines,
  type RawRow,
} from '../driveApi'

// Raw sheet rows: [program, routine, exercise, sets, reps, value, unit, notes]
const raw = (program: string, routine: string, exercise: string, value: string | number = 100): RawRow =>
  [program, routine, exercise, '3', 5, value, 'lbs', '']

describe('replaceRoutineInRows (raw)', () => {
  it('replaces the target routine in place and keeps order', () => {
    const all = [raw('P', 'A', 'X'), raw('P', 'B', 'Y'), raw('P', 'A', 'X2')]
    const out = replaceRoutineInRows(all, 'P', 'A', [raw('P', 'A', 'Z')])
    expect(out.map((r) => r[2])).toEqual(['Z', 'Y'])
  })

  it('appends when the routine is new', () => {
    const all = [raw('P', 'B', 'Y')]
    const out = replaceRoutineInRows(all, 'P', 'A', [raw('P', 'A', 'Z')])
    expect(out.map((r) => String(r[1]))).toEqual(['B', 'A'])
  })

  it('passes foreign rows through byte-identical — no normalization', () => {
    // hand-authored content the parser cannot represent
    const foreign: RawRow = ['Q', 'Heavy Day', 'Yoke Carry', '3', '8-12 each leg', 'work up to max', 'lbs', 'note']
    const fractional: RawRow = ['Q', 'Waves', 'Bench', '3', 5, '77.5%', 'lbs', '']
    const all = [foreign, fractional, raw('P', 'A', 'X')]
    const out = replaceRoutineInRows(all, 'P', 'A', [raw('P', 'A', 'Z')])
    expect(out[0]).toBe(foreign)
    expect(out[1]).toBe(fractional)
  })

  it('supports renaming: matches the original name, inserts rows carrying the new name', () => {
    const all = [raw('P', 'Push A', 'Bench'), raw('P', 'Pull', 'Row')]
    const out = replaceRoutineInRows(all, 'P', 'Push A', [raw('P', 'Push B', 'Bench')])
    expect(out.map((r) => String(r[1]))).toEqual(['Push B', 'Pull'])
  })
})

describe('deleteRoutineInRows (raw)', () => {
  it('removes only the target routine', () => {
    const all = [raw('P', 'A', 'X'), raw('P', 'B', 'Y')]
    expect(deleteRoutineInRows(all, 'P', 'A').map((r) => String(r[1]))).toEqual(['B'])
  })
})

describe('reorderProgramRoutines', () => {
  const getP = (r: RawRow) => String(r[0])
  const getR = (r: RawRow) => String(r[1])

  it('reorders routine blocks within the program, other programs untouched', () => {
    const all = [
      raw('Q', 'Z', 'Zed'),
      raw('P', 'A', 'X1'), raw('P', 'A', 'X2'),
      raw('P', 'B', 'Y'),
      raw('Q', 'W', 'Wye'),
    ]
    const out = reorderProgramRoutines(all, 'P', ['B', 'A'], getP, getR)
    expect(out.map((r) => `${r[0]}:${r[1]}:${r[2]}`)).toEqual([
      'Q:Z:Zed', 'P:B:Y', 'P:A:X1', 'P:A:X2', 'Q:W:Wye',
    ])
  })

  it('keeps routines the order list omits, after the ordered ones', () => {
    const all = [raw('P', 'A', 'X'), raw('P', 'B', 'Y'), raw('P', 'C', 'Z')]
    const out = reorderProgramRoutines(all, 'P', ['C', 'A'], getP, getR)
    expect(out.map((r) => String(r[1]))).toEqual(['C', 'A', 'B'])
  })
})

describe('renameProgramInRows (raw)', () => {
  it('renames only column A of matching rows, preserving the rest untouched', () => {
    const all = [raw('P', 'A', 'X', '77.5%'), raw('Q', 'B', 'Y')]
    const out = renameProgramInRows(all, 'P', 'P2')
    expect(out.map((r) => String(r[0]))).toEqual(['P2', 'Q'])
    expect(out[0][5]).toBe('77.5%')
    expect(out[1]).toBe(all[1])
  })
})

describe('deleteProgramInRows (raw)', () => {
  it('removes all rows of the program', () => {
    const all = [raw('P', 'A', 'X'), raw('P', 'B', 'Y'), raw('Q', 'C', 'Z')]
    const out = deleteProgramInRows(all, 'P')
    expect(out.map((r) => String(r[0]))).toEqual(['Q'])
  })
})
