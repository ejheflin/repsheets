import type { RoutineRow, EditableExercise, EditableRoutine, EditableSet } from '../types'
import { parseSets, serializeSets } from '../sheets/routineSerialization'

export function toEditable(rows: RoutineRow[]): EditableRoutine {
  const program = rows[0]?.program ?? ''
  const routine = rows[0]?.routine ?? ''
  const order: string[] = []
  const byExercise = new Map<string, RoutineRow[]>()
  for (const r of rows) {
    if (!byExercise.has(r.exercise)) { byExercise.set(r.exercise, []); order.push(r.exercise) }
    byExercise.get(r.exercise)!.push(r)
  }
  const exercises: EditableExercise[] = order.map((name) => {
    const rs = byExercise.get(name)!
    const sets: EditableSet[] = []
    let group: string | null = null
    let cursor = 0
    for (const r of rs) {
      const { count, group: g } = parseSets(r.sets)
      if (g) group = g
      // fill-up: count is the cumulative target set number; emit (count - cursor) sets
      const toEmit = count - cursor
      for (let i = 0; i < toEmit; i++) {
        sets.push({
          reps: r.reps,
          value: r.value,
          pct: r.pct ?? null,
          ...(r.rpe !== undefined ? { rpe: r.rpe } : {}),
          ...(r.rir !== undefined ? { rir: r.rir } : {}),
        })
      }
      cursor = count
    }
    const usesPct = sets.some((s) => s.pct != null)
    return {
      exercise: name,
      unit: rs[0].unit,
      notes: rs[0].notes,
      basis: (rs.find((r) => r.basis)?.basis ?? '1rm'),
      loadMode: usesPct ? 'pct' : 'lb',
      supersetGroup: group,
      sets,
    }
  })
  return { program, routine, exercises }
}

export function toRows(ed: EditableRoutine): RoutineRow[] {
  const out: RoutineRow[] = []
  for (const ex of ed.exercises) {
    let i = 0
    let cumulative = 0
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
  }
  return out
}

function sameSet(a: EditableSet, b: EditableSet): boolean {
  return a.reps === b.reps && a.value === b.value && a.pct === b.pct && a.rpe === b.rpe && a.rir === b.rir
}
