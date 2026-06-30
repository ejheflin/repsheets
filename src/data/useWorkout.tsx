import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from './useSheetContext'
import { useAlias } from './AliasProvider'
import { expandRoutine } from '../workout/setInference'
import { resolveSetValues } from '../workout/autofill'
import { fetchRoutineRows, fetchLogEntries, appendLogEntries, updateLogRows, type IndexedLogEntry } from '../sheets/sheetsApi'
import { localDateString } from '../utils'
import { saveWorkout, getWorkout, clearWorkout, saveLogs, getLogs, getRoutines, queueLogEntries, saveRoutines } from './db'
import { checkPendingSync } from './syncEngine'
import { serializeAchieved } from '../workout/achievedRpe'
import type { RoutineRow, WorkoutState, WorkoutExercise, WorkoutSet, LogEntry, EditModeState } from '../types'

/** Resolve the achieved RPE/RIR to log for a set, defaulting to the prescription. */
function loggedAchieved(set: WorkoutSet): { rpe: number | null; rir: number | null } {
  if (set.rpe != null || set.achievedRpe != null) {
    return { rpe: set.achievedRpe ?? set.rpe ?? null, rir: null }
  }
  if (set.rir != null || set.achievedRir != null) {
    return { rpe: null, rir: set.achievedRir ?? set.rir ?? null }
  }
  return { rpe: null, rir: null }
}

function formatAthleteName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return parts[0] || ''
  return `${parts[0]} ${parts[parts.length - 1][0]}`
}

const REFRESH_TIMEOUT_MS = 5000

interface WorkoutContextValue {
  workout: WorkoutState | null
  isLoading: boolean
  startWorkout: (program: string, routineName: string, routineRows: RoutineRow[]) => Promise<void>
  loadPastWorkout: (entries: IndexedLogEntry[], program: string, routine: string, athlete: string, date: string) => Promise<void>
  prefillPctValue: (exerciseIdx: number, setIdx: number, value: number) => void
  updateEditDate: (date: string) => void
  saveEditedWorkout: () => Promise<void>
  toggleSet: (exerciseIdx: number, setIdx: number) => void
  toggleExercise: (exerciseIdx: number) => void
  updateSet: (exerciseIdx: number, setIdx: number, field: 'reps' | 'value' | 'achievedRpe' | 'achievedRir', val: number | null) => void
  updateAllSets: (exerciseIdx: number, field: 'reps' | 'value', val: number | null) => void
  updateNotes: (exerciseIdx: number, notes: string) => void
  toggleExpanded: (exerciseIdx: number) => void
  addSet: (exerciseIdx: number) => void
  removeSet: (exerciseIdx: number, setIdx: number) => void
  reorderExercises: (fromIdx: number, toIdx: number) => void
  removeExercise: (exerciseIdx: number) => void
  renameExercise: (exerciseIdx: number, newName: string) => void
  finishWorkout: (logOnlyCompleted: boolean) => Promise<{ entries: LogEntry[]; exercisesWithAddedSets: WorkoutExercise[] } | undefined>
  discardWorkout: () => Promise<void>
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const { alias, isLoadingAlias } = useAlias()
  const [workout, setWorkout] = useState<WorkoutState | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const w = await getWorkout()
      if (!w) { setIsLoading(false); return }

      // Backfill pct from cached routines so the target column is present before
      // the async refresh effect runs (fixes saves predating pct support).
      if (spreadsheetId) {
        const cached = await getRoutines(spreadsheetId)
        const routineRows = cached.filter((r) => r.program === w.program && r.routine === w.routine)
        if (routineRows.length > 0) {
          const expanded = expandRoutine(routineRows)
          const patched = structuredClone(w)
          for (const ex of patched.exercises) {
            for (const set of ex.sets) {
              if (set.pct !== undefined) continue
              const match = expanded.find(
                (s) => s.exercise === ex.exercise && s.setNumber === set.setNumber
              )
              if (match) {
                // Carry the full current prescription, not just pct, so a set whose
                // routine is now rpe/rir doesn't get a stale pct resurrected.
                set.pct = match.pct ?? null
                set.rpe = match.rpe ?? null
                set.rir = match.rir ?? null
              }
            }
          }
          setWorkout(patched)
          setIsLoading(false)
          return
        }
      }

      setWorkout(w)
      setIsLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (workout) {
      saveWorkout(workout)
    }
  }, [workout])

  // Refresh persisted workout from Google Sheets on load
  const hasRefreshed = useRef(false)
  useEffect(() => {
    if (hasRefreshed.current || !workout || workout.editMode || !spreadsheetId || !user || isLoading || isLoadingAlias) return
    hasRefreshed.current = true

    const refreshWorkout = async () => {
      try {
        const [routineRows, logs] = await Promise.race([
          Promise.all([
            fetchRoutineRows(spreadsheetId),
            fetchLogEntries(spreadsheetId),
          ]),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), REFRESH_TIMEOUT_MS)
          ),
        ])

        await saveLogs(spreadsheetId, logs)

        // Find the rows for this workout's routine
        const workoutRows = routineRows.filter(
          (r) => r.program === workout.program && r.routine === workout.routine
        )
        if (workoutRows.length === 0) return

        const expanded = expandRoutine(workoutRows)

        setWorkout((prev) => {
          if (!prev) return prev
          const next = structuredClone(prev)

          for (const ex of next.exercises) {
            // Update coach notes from latest routine config
            const matchingExpanded = expanded.find((s) => s.exercise === ex.exercise)
            if (matchingExpanded) {
              ex.notes = matchingExpanded.notes
            }

            // Update autofill values and pct for untouched sets
            for (const set of ex.sets) {
              if (set.completed || set.isAdded) continue
              const resolved = resolveSetValues(
                { exercise: ex.exercise, setNumber: set.setNumber, reps: null, value: null, pct: null, unit: set.unit, notes: '', supersetGroup: null },
                logs,
                prev.program,
                prev.routine,
                alias ?? formatAthleteName(user.name)
              )
              if (resolved.reps !== null) set.reps = resolved.reps
              if (resolved.value !== null) set.value = resolved.value
              // Refresh pct from latest routine in case coach changed percentages
              const matchingSet = expanded.find(
                (s) => s.exercise === ex.exercise && s.setNumber === set.setNumber
              )
              if (matchingSet) {
                set.pct = matchingSet.pct
                set.rpe = matchingSet.rpe ?? null
                set.rir = matchingSet.rir ?? null
              }
            }
          }

          return next
        })
      } catch {
        // Timeout or error — keep cached workout as-is
      }
    }

    refreshWorkout()
  }, [workout, spreadsheetId, user, isLoading, isLoadingAlias, alias])

  const startWorkout = useCallback(async (
    program: string,
    routineName: string,
    routineRows: RoutineRow[]
  ) => {
    if (!spreadsheetId || !user) return

    const [routineResult, logResult] = await Promise.allSettled([
      fetchRoutineRows(spreadsheetId).then(async (rows) => {
        await saveRoutines(spreadsheetId, rows)
        return rows
      }),
      fetchLogEntries(spreadsheetId).then(async (entries) => {
        await saveLogs(spreadsheetId, entries)
        return entries
      }),
    ])

    const filtered = routineResult.status === 'fulfilled'
      ? routineResult.value.filter((r) => r.program === program && r.routine === routineName)
      : []
    const freshRows = filtered.length > 0 ? filtered : routineRows
    const expanded = expandRoutine(freshRows)

    const logs: LogEntry[] = logResult.status === 'fulfilled'
      ? logResult.value
      : await getLogs(spreadsheetId)

    const exerciseNames: string[] = []
    for (const s of expanded) {
      if (!exerciseNames.includes(s.exercise)) {
        exerciseNames.push(s.exercise)
      }
    }

    const exercises: WorkoutExercise[] = exerciseNames.map((name) => {
      const sets = expanded.filter((s) => s.exercise === name)
      const firstSet = sets[0]
      return {
        exercise: name,
        notes: firstSet?.notes ?? '',
        userNotes: '',
        supersetGroup: firstSet?.supersetGroup ?? null,
        isExpanded: false,
        sets: sets.map((s) => {
          const resolved = resolveSetValues(s, logs, program, routineName, alias ?? formatAthleteName(user.name))
          return {
            setNumber: s.setNumber,
            reps: resolved.reps,
            value: resolved.value,
            pct: s.pct,
            rpe: s.rpe ?? null,
            rir: s.rir ?? null,
            unit: s.unit,
            completed: false,
            isAdded: false,
            fromPct: s.pct != null && resolved.value === null,
          }
        }),
      }
    })

    const state: WorkoutState = {
      program,
      routine: routineName,
      exercises,
      startedAt: new Date().toISOString(),
    }

    setWorkout(state)
  }, [spreadsheetId, user, alias])

  const toggleSet = useCallback((exerciseIdx: number, setIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[exerciseIdx].sets[setIdx].completed =
        !next.exercises[exerciseIdx].sets[setIdx].completed
      return next
    })
  }, [])

  const toggleExercise = useCallback((exerciseIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const ex = next.exercises[exerciseIdx]
      const allCompleted = ex.sets.every((s) => s.completed)
      ex.sets.forEach((s) => { s.completed = !allCompleted })
      return next
    })
  }, [])

  const prefillPctValue = useCallback((exerciseIdx: number, setIdx: number, value: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const set = next.exercises[exerciseIdx].sets[setIdx]
      set.value = value
      set.fromPct = true
      return next
    })
  }, [])

  const updateSet = useCallback((
    exerciseIdx: number,
    setIdx: number,
    field: 'reps' | 'value' | 'achievedRpe' | 'achievedRir',
    val: number | null
  ) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const set = next.exercises[exerciseIdx].sets[setIdx]
      set[field] = val
      if (field === 'value') set.fromPct = false
      return next
    })
  }, [])

  const updateAllSets = useCallback((
    exerciseIdx: number,
    field: 'reps' | 'value',
    val: number | null
  ) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[exerciseIdx].sets.forEach((s) => {
        s[field] = val
        if (field === 'value') s.fromPct = false
      })
      return next
    })
  }, [])

  const updateNotes = useCallback((exerciseIdx: number, notes: string) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[exerciseIdx].userNotes = notes
      return next
    })
  }, [])

  const toggleExpanded = useCallback((exerciseIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[exerciseIdx].isExpanded = !next.exercises[exerciseIdx].isExpanded
      return next
    })
  }, [])

  const addSet = useCallback((exerciseIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const ex = next.exercises[exerciseIdx]
      const lastSet = ex.sets[ex.sets.length - 1]
      ex.sets.push({
        setNumber: lastSet.setNumber + 1,
        reps: lastSet.reps,
        value: lastSet.value,
        pct: lastSet.pct,
        rpe: lastSet.rpe ?? null,
        rir: lastSet.rir ?? null,
        unit: lastSet.unit,
        completed: false,
        isAdded: true,
      })
      return next
    })
  }, [])

  const removeSet = useCallback((exerciseIdx: number, setIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const ex = next.exercises[exerciseIdx]
      ex.sets.splice(setIdx, 1)
      ex.sets.forEach((s, i) => { s.setNumber = i + 1 })
      return next
    })
  }, [])

  const reorderExercises = useCallback((fromIdx: number, toIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const [moved] = next.exercises.splice(fromIdx, 1)
      next.exercises.splice(toIdx, 0, moved)
      return next
    })
  }, [])

  const removeExercise = useCallback((exerciseIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises.splice(exerciseIdx, 1)
      return next
    })
  }, [])

  const renameExercise = useCallback((exerciseIdx: number, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[exerciseIdx].exercise = trimmed
      return next
    })
  }, [])

  const loadPastWorkout = useCallback(async (
    entries: IndexedLogEntry[],
    program: string,
    routine: string,
    athlete: string,
    date: string
  ) => {
    const exerciseNames: string[] = []
    for (const e of entries) {
      if (!exerciseNames.includes(e.exercise)) exerciseNames.push(e.exercise)
    }

    const exercises: WorkoutExercise[] = exerciseNames.map((name) => {
      const exEntries = entries.filter((e) => e.exercise === name)
      return {
        exercise: name,
        notes: '',
        userNotes: exEntries[0]?.notes ?? '',
        supersetGroup: null,
        isExpanded: false,
        sets: exEntries.map((e) => ({
          setNumber: e.set,
          reps: e.reps,
          value: e.value,
          pct: e.pct ?? null,
          achievedRpe: e.achievedRpe ?? null,
          achievedRir: e.achievedRir ?? null,
          unit: e.unit,
          completed: true,
          isAdded: false,
          rowIndex: e.rowIndex,
        })),
      }
    })

    const editMode: EditModeState = { originalDate: date, editDate: date, athlete }
    setWorkout({ program, routine, exercises, startedAt: new Date().toISOString(), editMode })
  }, [])

  const updateEditDate = useCallback((date: string) => {
    setWorkout((prev) => {
      if (!prev?.editMode) return prev
      const next = structuredClone(prev)
      next.editMode!.editDate = date
      return next
    })
  }, [])

  const saveEditedWorkout = useCallback(async () => {
    if (!workout?.editMode || !spreadsheetId) return
    const { editDate, athlete } = workout.editMode
    const updates: Array<{ rowIndex: number; entry: LogEntry }> = []
    for (const ex of workout.exercises) {
      for (const set of ex.sets) {
        if (set.rowIndex == null) continue
        const achieved = loggedAchieved(set)
        updates.push({
          rowIndex: set.rowIndex,
          entry: {
            date: editDate,
            athlete,
            program: workout.program,
            routine: workout.routine,
            exercise: ex.exercise,
            set: set.setNumber,
            reps: set.reps ?? 0,
            value: set.value,
            unit: set.unit,
            notes: serializeAchieved(ex.userNotes, achieved.rpe, achieved.rir),
            pct: set.pct ?? null,
          },
        })
      }
    }
    await updateLogRows(spreadsheetId, updates)
    await clearWorkout()
    setWorkout(null)
  }, [workout, spreadsheetId])

  const finishWorkout = useCallback(async (logOnlyCompleted: boolean) => {
    if (!workout || !spreadsheetId || !user) return
    if (workout.editMode) return

    const today = localDateString()
    const entries: LogEntry[] = []

    for (const ex of workout.exercises) {
      for (const set of ex.sets) {
        if (logOnlyCompleted && !set.completed) continue
        const achieved = loggedAchieved(set)
        entries.push({
          date: today,
          athlete: alias ?? formatAthleteName(user.name),
          program: workout.program,
          routine: workout.routine,
          exercise: ex.exercise,
          set: set.setNumber,
          reps: set.reps ?? 0,
          value: set.value,
          unit: set.unit,
          notes: serializeAchieved(ex.userNotes, achieved.rpe, achieved.rir),
          pct: set.pct ?? null,
        })
      }
    }

    try {
      await appendLogEntries(spreadsheetId, entries)
    } catch {
      await queueLogEntries(spreadsheetId, entries)
    }
    await checkPendingSync(spreadsheetId)

    const exercisesWithAddedSets = workout.exercises.filter((ex) =>
      ex.sets.some((s) => s.isAdded)
    )

    await clearWorkout()
    setWorkout(null)

    return { entries, exercisesWithAddedSets }
  }, [workout, spreadsheetId, user])

  const discardWorkout = useCallback(async () => {
    await clearWorkout()
    setWorkout(null)
  }, [])

  return (
    <WorkoutContext.Provider value={{
      workout, isLoading, startWorkout, loadPastWorkout, prefillPctValue, updateEditDate, saveEditedWorkout,
      toggleSet, toggleExercise, updateSet, updateAllSets, updateNotes, toggleExpanded,
      addSet, removeSet, reorderExercises, removeExercise, renameExercise, finishWorkout, discardWorkout,
    }}>
      {children}
    </WorkoutContext.Provider>
  )
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext)
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider')
  return ctx
}
