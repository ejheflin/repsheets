import type { EditableRoutine, EditableExercise } from '../types'
import { MEASURES, WEIGHT_UNITS, DISTANCE_UNITS, type Measure } from './measure'
import { newExerciseId } from './routineModel'

export type Action =
  | { type: 'setRoutine'; name: string }
  | { type: 'setSetCount'; ex: number; count: number }
  | { type: 'setUniformReps'; ex: number; reps: number | null }
  | { type: 'setUniformLoad'; ex: number; value: number | null; pct: number | null }
  | { type: 'setLoadMode'; ex: number; mode: 'lb' | 'pct' }
  | { type: 'setMeasure'; ex: number; measure: Measure }
  | { type: 'setUnit'; ex: number; unit: string }
  | { type: 'setBasis'; ex: number; basis: '1rm' | 'tm' }
  | { type: 'addExercise'; name: string; unit: string }
  | { type: 'removeExercise'; ex: number }
  | { type: 'duplicateExercise'; ex: number }
  | { type: 'insertExercise'; index: number; exercise: EditableExercise }
  | { type: 'reorder'; from: number; to: number }
  | { type: 'setPerSet'; ex: number; set: number; reps?: number | null; value?: number | null; pct?: number | null; rpe?: number | null; rir?: number | null }
  | { type: 'addSet'; ex: number }
  | { type: 'removeSet'; ex: number; set: number }
  | { type: 'groupWithNext'; ex: number }
  | { type: 'ungroup'; ex: number }
  | { type: 'renameExercise'; ex: number; name: string }
  | { type: 'setLoadType'; ex: number; loadType: 'weight' | 'pct' | 'rpe' | 'rir' | 'bodyweight' | 'time' | 'distance'; unit?: string }
  | { type: 'setLoadValue'; ex: number; value: number | null }
  | { type: 'setReps'; ex: number; reps: number | null; repsMax?: number | null; repsOpen?: boolean }

const isWeightUnit = (u: string): boolean => (WEIGHT_UNITS as readonly string[]).includes(u)
const isDistanceUnit = (u: string): boolean => (DISTANCE_UNITS as readonly string[]).includes(u)

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
    case 'setMeasure': {
      const e = at(a.ex)
      e.unit = MEASURES[a.measure].defaultUnit
      if (a.measure !== 'weight') { e.loadMode = 'lb'; e.sets.forEach((s) => { s.pct = null }) }
      return { ...state, exercises: exs }
    }
    case 'setUnit': { at(a.ex).unit = a.unit; return { ...state, exercises: exs } }
    case 'setBasis': { at(a.ex).basis = a.basis; return { ...state, exercises: exs } }
    case 'addExercise': {
      exs.push({ id: newExerciseId(), exercise: a.name, unit: a.unit, notes: '', basis: '1rm', loadMode: 'lb', supersetGroup: null,
        sets: [{ reps: 5, value: null, pct: null }, { reps: 5, value: null, pct: null }, { reps: 5, value: null, pct: null }] })
      return { ...state, exercises: exs }
    }
    case 'removeExercise': { exs.splice(a.ex, 1); return { ...state, exercises: exs } }
    case 'duplicateExercise': {
      const src = exs[a.ex]
      if (!src) return state
      const copy: EditableExercise = { ...src, id: newExerciseId(), sets: src.sets.map((s) => ({ ...s })) }
      exs.splice(a.ex + 1, 0, copy)
      return { ...state, exercises: exs }
    }
    case 'insertExercise': {
      const idx = Math.max(0, Math.min(a.index, exs.length))
      const copy: EditableExercise = { ...a.exercise, sets: a.exercise.sets.map((s) => ({ ...s })) }
      exs.splice(idx, 0, copy)
      return { ...state, exercises: exs }
    }
    case 'reorder': { const [m] = exs.splice(a.from, 1); exs.splice(a.to, 0, m); return { ...state, exercises: exs } }
    case 'setPerSet': {
      const s = at(a.ex).sets[a.set]
      if (a.reps !== undefined) s.reps = a.reps
      if (a.value !== undefined) s.value = a.value
      if (a.pct !== undefined) s.pct = a.pct
      if (a.rpe !== undefined) s.rpe = a.rpe ?? undefined
      if (a.rir !== undefined) s.rir = a.rir ?? undefined
      return { ...state, exercises: exs }
    }
    case 'addSet': {
      const e = at(a.ex)
      const last = e.sets[e.sets.length - 1] ?? { reps: null, value: null, pct: null }
      e.sets.push({ ...last })
      return { ...state, exercises: exs }
    }
    case 'removeSet': {
      const e = at(a.ex)
      if (e.sets.length <= 1) return { ...state, exercises: exs }
      e.sets.splice(a.set, 1)
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
    case 'renameExercise': { at(a.ex).exercise = a.name; return { ...state, exercises: exs } }
    case 'setLoadType': {
      const e = at(a.ex)
      switch (a.loadType) {
        case 'weight':
          e.unit = a.unit ?? (isWeightUnit(e.unit) ? e.unit : 'lbs')
          e.loadMode = 'lb'
          e.sets.forEach((s) => { s.pct = null; s.rpe = undefined; s.rir = undefined })
          break
        case 'pct':
          // Seed a default so the mode is expressible in the value cell; without a
          // number there's no token to serialize and the mode silently reverts.
          e.unit = a.unit ?? (isWeightUnit(e.unit) ? e.unit : 'lbs')
          e.loadMode = 'pct'
          e.sets.forEach((s) => { s.value = null; s.rpe = undefined; s.rir = undefined; s.pct = s.pct ?? 80 })
          break
        case 'rpe':
          e.unit = a.unit ?? (isWeightUnit(e.unit) ? e.unit : 'lbs')
          e.loadMode = 'rpe'
          e.sets.forEach((s) => { s.value = null; s.pct = null; s.rir = undefined; s.rpe = s.rpe ?? 8 })
          break
        case 'rir':
          e.unit = a.unit ?? (isWeightUnit(e.unit) ? e.unit : 'lbs')
          e.loadMode = 'rir'
          e.sets.forEach((s) => { s.value = null; s.pct = null; s.rpe = undefined; s.rir = s.rir ?? 2 })
          break
        case 'bodyweight':
          e.unit = ''
          e.loadMode = 'lb'
          e.sets.forEach((s) => { s.value = null; s.pct = null; s.rpe = undefined; s.rir = undefined })
          break
        case 'time':
          e.unit = a.unit ?? MEASURES.time.defaultUnit
          e.loadMode = 'lb'
          e.sets.forEach((s) => { s.pct = null; s.rpe = undefined; s.rir = undefined })
          break
        case 'distance':
          e.unit = a.unit ?? (isDistanceUnit(e.unit) ? e.unit : MEASURES.distance.defaultUnit)
          e.loadMode = 'lb'
          e.sets.forEach((s) => { s.pct = null; s.rpe = undefined; s.rir = undefined })
          break
      }
      return { ...state, exercises: exs }
    }
    case 'setLoadValue': {
      const e = at(a.ex)
      const v = a.value
      e.sets.forEach((s) => {
        switch (e.loadMode) {
          case 'lb': s.value = v; s.pct = null; s.rpe = undefined; s.rir = undefined; break
          case 'pct': s.pct = v; s.value = null; s.rpe = undefined; s.rir = undefined; break
          case 'rpe': s.rpe = v ?? undefined; s.value = null; s.pct = null; s.rir = undefined; break
          case 'rir': s.rir = v ?? undefined; s.value = null; s.pct = null; s.rpe = undefined; break
        }
      })
      return { ...state, exercises: exs }
    }
    case 'setReps': {
      at(a.ex).sets.forEach((s) => {
        s.reps = a.reps
        s.repsMax = a.repsMax ?? undefined
        s.repsOpen = a.repsOpen ?? undefined
      })
      return { ...state, exercises: exs }
    }
  }
}
