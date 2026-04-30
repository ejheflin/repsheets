import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from './useSheetContext'
import { useAlias } from './AliasProvider'
import { expandRoutine } from '../workout/setInference'
import { resolveSetValues } from '../workout/autofill'
import { fetchRoutineRows, fetchLogEntries, appendLogEntries, updateLogRows, type IndexedLogEntry } from '../sheets/sheetsApi'
import { localDateString } from '../utils'
import { saveWorkout, getWorkout, clearWorkout, saveLogs, getLogs, queueLogEntries } from './db'
import { checkPendingSync } from './syncEngine'
import type { RoutineRow, WorkoutState, WorkoutExercise, LogEntry, EditModeState } from '../types'

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
  updateEditDate: (date: string) => void
  saveEditedWorkout: () => Promise<void>
  toggleSet: (exerciseIdx: number, setIdx: number) => void
  toggleExercise: (exerciseIdx: number) => void
  updateSet: (exerciseIdx: number, setIdx: number, field: 'reps' | 'value', val: number | null) => void
  updateAllSets: (exerciseIdx: number, field: 'reps' | 'value', val: number | null) => void
  updateNotes: (exerciseIdx: number, notes: string) => void
  toggleExpanded: (exerciseIdx: number) => void
  addSet: (exerciseIdx: number) => void
  finishWorkout: (logOnlyCompleted: boolean) => Promise<{ entries: LogEntry[]; exercisesWithAddedSets: WorkoutExercise[] } | undefined>
  discardWorkout: () => Promise<void>
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const { alias } = useAlias()
  const [workout, setWorkout] = useState<WorkoutState | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getWorkout().then((w) => {
      if (w) setWorkout(w)
      setIsLoading(false)
    })
  }, [])

  useEffect(() => {
    if (workout) {
      saveWorkout(workout)
    }
  }, [workout])

  // Refresh persisted workout from Google Sheets on load
  const hasRefreshed = useRef(false)
  useEffect(() => {
    if (hasRefreshed.current || !workout || workout.editMode || !spreadsheetId || !user || isLoading) return
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
              if (matchingSet) set.pct = matchingSet.pct
            }
          }

          return next
        })
      } catch {
        // Timeout or error — keep cached workout as-is
      }
    }

    refreshWorkout()
  }, [workout, spreadsheetId, user, isLoading])

  const startWorkout = useCallback(async (
    program: string,
    routineName: string,
    routineRows: RoutineRow[]
  ) => {
    if (!spreadsheetId || !user) return

    const expanded = expandRoutine(routineRows)

    let logs: LogEntry[] = []
    try {
      logs = await fetchLogEntries(spreadsheetId)
      await saveLogs(spreadsheetId, logs)
    } catch {
      logs = await getLogs(spreadsheetId)
    }

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
            unit: s.unit,
            completed: false,
            isAdded: false,
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
  }, [spreadsheetId, user])

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

  const updateSet = useCallback((
    exerciseIdx: number,
    setIdx: number,
    field: 'reps' | 'value',
    val: number | null
  ) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      next.exercises[exerciseIdx].sets[setIdx][field] = val
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
      next.exercises[exerciseIdx].sets.forEach((s) => { s[field] = val })
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
        unit: lastSet.unit,
        completed: false,
        isAdded: true,
      })
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
            notes: ex.userNotes,
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
          notes: ex.userNotes,
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
      workout, isLoading, startWorkout, loadPastWorkout, updateEditDate, saveEditedWorkout,
      toggleSet, toggleExercise, updateSet, updateAllSets, updateNotes, toggleExpanded,
      addSet, finishWorkout, discardWorkout,
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
