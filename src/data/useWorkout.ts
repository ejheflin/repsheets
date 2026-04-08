import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from './useSheetContext'
import { expandRoutine } from '../workout/setInference'
import { resolveSetValues } from '../workout/autofill'
import { fetchLogEntries, appendLogEntries } from '../sheets/sheetsApi'
import { saveWorkout, getWorkout, clearWorkout, saveLogs, getLogs, queueLogEntries } from './db'
import type { RoutineRow, WorkoutState, WorkoutExercise, LogEntry } from '../types'

export function useWorkout() {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
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

  const startWorkout = useCallback(async (
    program: string,
    routineName: string,
    routineRows: RoutineRow[]
  ) => {
    if (!spreadsheetId || !user) return

    const expanded = expandRoutine(routineRows)

    let logs: LogEntry[] = []
    try {
      logs = await fetchLogEntries(spreadsheetId, user.accessToken)
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
        supersetGroup: firstSet?.supersetGroup ?? null,
        isExpanded: false,
        sets: sets.map((s) => {
          const resolved = resolveSetValues(s, logs, program, routineName)
          return {
            setNumber: s.setNumber,
            reps: resolved.reps,
            value: resolved.value,
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
        unit: lastSet.unit,
        completed: false,
        isAdded: true,
      })
      return next
    })
  }, [])

  const finishWorkout = useCallback(async (logOnlyCompleted: boolean) => {
    if (!workout || !spreadsheetId || !user) return

    const today = new Date().toISOString().split('T')[0]
    const entries: LogEntry[] = []

    for (const ex of workout.exercises) {
      for (const set of ex.sets) {
        if (logOnlyCompleted && !set.completed) continue
        entries.push({
          date: today,
          athlete: user.email,
          program: workout.program,
          routine: workout.routine,
          exercise: ex.exercise,
          set: set.setNumber,
          reps: set.reps ?? 0,
          value: set.value,
          unit: set.unit,
          notes: ex.notes,
        })
      }
    }

    try {
      await appendLogEntries(spreadsheetId, user.accessToken, entries)
    } catch {
      await queueLogEntries(spreadsheetId, entries)
    }

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

  return {
    workout,
    isLoading,
    startWorkout,
    toggleSet,
    toggleExercise,
    updateSet,
    toggleExpanded,
    addSet,
    finishWorkout,
    discardWorkout,
  }
}
