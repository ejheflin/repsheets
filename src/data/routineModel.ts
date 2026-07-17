import type { RoutineRow, EditableExercise, EditableRoutine, EditableSet } from '../types'
import { parseSets, serializeSets } from '../sheets/routineSerialization'

let idCounter = 0
export function newExerciseId(): string {
  return `e${++idCounter}`
}

export function toEditable(rows: RoutineRow[]): EditableRoutine {
  const program = rows[0]?.program ?? ''
  const routine = rows[0]?.routine ?? ''
  // Group ADJACENT same-name runs only, exactly like expandRoutine does.
  // Grouping globally by name merged non-adjacent blocks (Squat / Bench /
  // Squat-backoff) and the cumulative cursor then swallowed the second
  // block's sets — a destructive round-trip.
  const exercises: EditableExercise[] = []
  let i = 0
  while (i < rows.length) {
    const name = rows[i].exercise
    const rs: RoutineRow[] = []
    while (i < rows.length && rows[i].exercise === name) { rs.push(rows[i]); i++ }

    const sets: EditableSet[] = []
    let group: string | null = null
    let cursor = 0
    for (const r of rs) {
      const { count, group: g } = parseSets(r.sets)
      if (g) group = g
      // fill-up: count is the cumulative target set number; emit (count - cursor) sets
      const toEmit = count - cursor
      for (let k = 0; k < toEmit; k++) {
        sets.push({
          reps: r.reps,
          ...(r.repsMax !== undefined ? { repsMax: r.repsMax } : {}),
          ...(r.repsOpen ? { repsOpen: true } : {}),
          value: r.value,
          pct: r.pct ?? null,
          ...(r.rpe !== undefined ? { rpe: r.rpe } : {}),
          ...(r.rir !== undefined ? { rir: r.rir } : {}),
        })
      }
      cursor = count
    }
    const usesPct = sets.some((s) => s.pct != null)
    const usesRpe = sets.some((s) => s.rpe != null)
    const usesRir = sets.some((s) => s.rir != null)
    exercises.push({
      id: newExerciseId(),
      exercise: name,
      unit: rs[0].unit,
      notes: rs[0].notes,
      basis: (rs.find((r) => r.basis)?.basis ?? '1rm'),
      // RPE/RIR prescriptions must load in their own mode — loading them as
      // "weight" meant one edit silently wiped the intensity data
      loadMode: usesPct ? 'pct' : usesRpe ? 'rpe' : usesRir ? 'rir' : 'lb',
      supersetGroup: group,
      sets,
    })
  }
  return { program, routine, exercises }
}

export function toRows(ed: EditableRoutine): RoutineRow[] {
  const out: RoutineRow[] = []
  let prevName: string | null = null
  let prevCumulative = 0
  for (const ex of ed.exercises) {
    if (!ex.exercise.trim()) continue
    let i = 0
    // Adjacent same-name exercises (e.g. swipe-Duplicate) continue the
    // cumulative set count — restarting it made the reader swallow the
    // second block ("3","3" reads as 3 sets; "3","6" reads as 3+3)
    let cumulative = ex.exercise === prevName ? prevCumulative : 0
    while (i < ex.sets.length) {
      let j = i + 1
      while (j < ex.sets.length && sameSet(ex.sets[i], ex.sets[j])) j++
      const count = j - i
      cumulative += count
      const s = ex.sets[i]
      const row: RoutineRow = {
        program: ed.program,
        routine: ed.routine,
        exercise: ex.exercise,
        sets: serializeSets(cumulative, ex.supersetGroup),
        reps: s.reps,
        ...(s.repsMax !== undefined && s.repsMax !== null ? { repsMax: s.repsMax } : {}),
        ...(s.repsOpen ? { repsOpen: true } : {}),
        value: ex.loadMode === 'pct' ? null : s.value,
        pct: ex.loadMode === 'pct' ? s.pct : null,
        ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
        ...(s.rir !== undefined ? { rir: s.rir } : {}),
        unit: ex.unit,
        notes: ex.notes,
      }
      if (ex.loadMode === 'pct') {
        row.basis = ex.basis
      }
      out.push(row)
      i = j
    }
    prevName = ex.exercise
    prevCumulative = cumulative
  }
  return out
}

function sameSet(a: EditableSet, b: EditableSet): boolean {
  return a.reps === b.reps && (a.repsMax ?? null) === (b.repsMax ?? null) && Boolean(a.repsOpen) === Boolean(b.repsOpen)
    && a.value === b.value && a.pct === b.pct && a.rpe === b.rpe && a.rir === b.rir
}
