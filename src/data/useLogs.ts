import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from './useSheetContext'
import { fetchLogEntries } from '../sheets/sheetsApi'
import { saveLogs, getLogs } from './db'
import type { LogEntry } from '../types'

export interface ExerciseHistoryPoint {
  date: string
  maxWeight: number
}

export interface PersonalRecord {
  exercise: string
  maxWeight: { value: number; date: string } | null
  maxReps: { value: number; date: string } | null
  maxVolume: { value: number; date: string } | null
}

export function useLogs() {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const [allLogs, setAllLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!spreadsheetId) return
    try {
      const logs = await fetchLogEntries(spreadsheetId)
      await saveLogs(spreadsheetId, logs)
      setAllLogs(logs)
    } catch {
      const cached = await getLogs(spreadsheetId)
      setAllLogs(cached)
    }
    setIsLoading(false)
  }, [spreadsheetId])

  useEffect(() => {
    const load = async () => {
      if (!spreadsheetId) { setIsLoading(false); return }
      const cached = await getLogs(spreadsheetId)
      if (cached.length > 0) {
        setAllLogs(cached)
        setIsLoading(false)
      }
      refresh()
    }
    load()
  }, [spreadsheetId, refresh])

  const logs = useMemo(() => {
    if (!user) return allLogs
    return allLogs.filter((l) => l.athlete === user.email)
  }, [allLogs, user])

  const workoutDates = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const log of logs) {
      if (!map.has(log.date)) map.set(log.date, [])
      const routines = map.get(log.date)!
      if (!routines.includes(log.routine)) routines.push(log.routine)
    }
    return map
  }, [logs])

  const routineFrequency = useCallback((weeks: number) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - weeks * 7)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    const freq = new Map<string, number>()
    const seen = new Set<string>()
    for (const log of logs) {
      if (log.date < cutoffStr) continue
      const key = `${log.date}|${log.routine}`
      if (seen.has(key)) continue
      seen.add(key)
      freq.set(log.routine, (freq.get(log.routine) ?? 0) + 1)
    }
    return freq
  }, [logs])

  const exerciseHistory = useCallback((exerciseName: string, limit: number = 10): ExerciseHistoryPoint[] => {
    const byDate = new Map<string, number>()
    for (const log of logs) {
      if (log.exercise !== exerciseName || log.value === null) continue
      const current = byDate.get(log.date) ?? 0
      if (log.value > current) byDate.set(log.date, log.value)
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-limit)
      .map(([date, maxWeight]) => ({ date, maxWeight }))
  }, [logs])

  const personalRecords = useMemo((): PersonalRecord[] => {
    const exercises = new Map<string, PersonalRecord>()
    for (const log of logs) {
      if (!exercises.has(log.exercise)) {
        exercises.set(log.exercise, {
          exercise: log.exercise,
          maxWeight: null, maxReps: null, maxVolume: null,
        })
      }
      const pr = exercises.get(log.exercise)!
      if (log.value !== null && (pr.maxWeight === null || log.value > pr.maxWeight.value)) {
        pr.maxWeight = { value: log.value, date: log.date }
      }
      if (pr.maxReps === null || log.reps > pr.maxReps.value) {
        pr.maxReps = { value: log.reps, date: log.date }
      }
      const volume = log.reps * (log.value ?? 0)
      if (volume > 0 && (pr.maxVolume === null || volume > pr.maxVolume.value)) {
        pr.maxVolume = { value: volume, date: log.date }
      }
    }
    return Array.from(exercises.values())
  }, [logs])

  const uniqueExercises = useMemo(() => {
    return [...new Set(logs.map((l) => l.exercise))]
  }, [logs])

  return {
    logs, isLoading, refresh, workoutDates, routineFrequency,
    exerciseHistory, personalRecords, uniqueExercises,
  }
}
