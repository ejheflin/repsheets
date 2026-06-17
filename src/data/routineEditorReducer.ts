import type { EditableRoutine, EditableExercise } from '../types'

export type Action =
  | { type: 'setRoutine'; name: string }
  | { type: 'setSetCount'; ex: number; count: number }
  | { type: 'setUniformReps'; ex: number; reps: number | null }
  | { type: 'setUniformLoad'; ex: number; value: number | null; pct: number | null }
  | { type: 'setLoadMode'; ex: number; mode: 'lb' | 'pct' }
  | { type: 'setBasis'; ex: number; basis: '1rm' | 'tm' }
  | { type: 'addExercise'; name: string; unit: string }
  | { type: 'removeExercise'; ex: number }
  | { type: 'reorder'; from: number; to: number }
  | { type: 'setPerSet'; ex: number; set: number; reps?: number | null; value?: number | null; pct?: number | null }
  | { type: 'groupWithNext'; ex: number }
  | { type: 'ungroup'; ex: number }

function nextFreeLetter(exs: EditableExercise[]): string {
  const used = new Set(exs.map((e) => e.supersetGroup).filter(Boolean) as string[])
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(97 + i)
    if (!used.has(c)) return c
  }
  return 'z'
}

export function reduce(state: EditableRoutine, a: Action): EditableRoutine {
  const exs = state.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }))
  const at = (i: number): EditableExercise => exs[i]
  switch (a.type) {
    case 'setRoutine': return { ...state, routine: a.name }
    case 'setSetCount': {
      const e = at(a.ex)
      const last = e.sets[e.sets.length - 1] ?? { reps: null, value: null, pct: null }
      if (a.count > e.sets.length) {
        while (e.sets.length < a.count) e.sets.push({ ...last })
      } else {
        e.sets.length = Math.max(1, a.count)
      }
      return { ...state, exercises: exs }
    }
    case 'setUniformReps': { at(a.ex).sets.forEach((s) => (s.reps = a.reps)); return { ...state, exercises: exs } }
    case 'setUniformLoad': { at(a.ex).sets.forEach((s) => { s.value = a.value; s.pct = a.pct }); return { ...state, exercises: exs } }
    case 'setLoadMode': { at(a.ex).loadMode = a.mode; return { ...state, exercises: exs } }
    case 'setBasis': { at(a.ex).basis = a.basis; return { ...state, exercises: exs } }
    case 'addExercise': {
      exs.push({ exercise: a.name, unit: a.unit, notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
        sets: [{ reps: 5, value: null, pct: null }, { reps: 5, value: null, pct: null }, { reps: 5, value: null, pct: null }] })
      return { ...state, exercises: exs }
    }
    case 'removeExercise': { exs.splice(a.ex, 1); return { ...state, exercises: exs } }
    case 'reorder': { const [m] = exs.splice(a.from, 1); exs.splice(a.to, 0, m); return { ...state, exercises: exs } }
    case 'setPerSet': {
      const s = at(a.ex).sets[a.set]
      if (a.reps !== undefined) s.reps = a.reps
      if (a.value !== undefined) s.value = a.value
      if (a.pct !== undefined) s.pct = a.pct
      return { ...state, exercises: exs }
    }
    case 'groupWithNext': {
      if (a.ex >= exs.length - 1) return state
      const cur = at(a.ex), next = at(a.ex + 1)
      const letter = cur.supersetGroup ?? next.supersetGroup ?? nextFreeLetter(exs)
      cur.supersetGroup = letter
      next.supersetGroup = letter
      return { ...state, exercises: exs }
    }
    case 'ungroup': { at(a.ex).supersetGroup = null; return { ...state, exercises: exs } }
  }
}
