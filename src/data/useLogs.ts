import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from './useSheetContext'
import { fetchLogEntries } from '../sheets/sheetsApi'
import { saveLogs, getLogs } from './db'
import type { LogEntry } from '../types'

export interface ExerciseHistoryPoint {
  date: string
  maxWeight: number
  athlete?: string
}

export interface PersonalRecord {
  exercise: string
  maxWeight: { value: number; date: string } | null
  maxReps: { value: number; date: string } | null
  maxVolume: { value: number; date: string } | null
}

export interface AthleteStats {
  name: string
  workoutsPerWeek: number
  totalWorkouts: number
  currentStreak: number
}

export function useLogs() {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const [allLogs, setAllLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null) // null = me

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

  const athleteName = useMemo(() => {
    if (!user) return null
    const parts = user.name.trim().split(/\s+/)
    if (parts.length < 2) return parts[0] || ''
    return `${parts[0]} ${parts[parts.length - 1][0]}`
  }, [user])

  // All distinct athletes in the log
  const athletes = useMemo(() => {
    return [...new Set(allLogs.map((l) => l.athlete))].filter(Boolean)
  }, [allLogs])

  // Is this a shared sheet? (more than one athlete)
  const isShared = useMemo(() => athletes.length > 1, [athletes])

  // My logs only (for autofill, personal use)
  const myLogs = useMemo(() => {
    if (!user) return allLogs
    return allLogs.filter((l) => l.athlete === athleteName || l.athlete === user.email)
  }, [allLogs, user, athleteName])

  // Filtered logs based on selected athlete
  const logs = useMemo(() => {
    if (selectedAthlete === null) return myLogs
    if (selectedAthlete === '__all__') return allLogs
    return allLogs.filter((l) => l.athlete === selectedAthlete)
  }, [allLogs, myLogs, selectedAthlete])

  const workoutDates = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const log of logs) {
      if (!map.has(log.date)) map.set(log.date, [])
      const routines = map.get(log.date)!
      if (!routines.includes(log.routine)) routines.push(log.routine)
    }
    return map
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

  // Leaderboard: per-exercise max weight across all athletes
  const leaderboard = useMemo(() => {
    if (!isShared) return []
    const board = new Map<string, Map<string, number>>() // exercise -> athlete -> maxWeight
    for (const log of allLogs) {
      if (log.value === null) continue
      if (!board.has(log.exercise)) board.set(log.exercise, new Map())
      const exerciseBoard = board.get(log.exercise)!
      const current = exerciseBoard.get(log.athlete) ?? 0
      if (log.value > current) exerciseBoard.set(log.athlete, log.value)
    }
    return Array.from(board.entries()).map(([exercise, athletes]) => ({
      exercise,
      rankings: Array.from(athletes.entries())
        .map(([athlete, maxWeight]) => ({ athlete, maxWeight }))
        .sort((a, b) => b.maxWeight - a.maxWeight),
    }))
  }, [allLogs, isShared])

  // Athlete stats for shared sheets
  const athleteStats = useMemo((): AthleteStats[] => {
    if (!isShared) return []
    const stats = new Map<string, { dates: Set<string>; sortedDates: string[] }>()
    for (const log of allLogs) {
      if (!stats.has(log.athlete)) stats.set(log.athlete, { dates: new Set(), sortedDates: [] })
      const s = stats.get(log.athlete)!
      if (!s.dates.has(log.date)) {
        s.dates.add(log.date)
        s.sortedDates.push(log.date)
      }
    }
    const now = new Date()
    const fourWeeksAgo = new Date(now)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    const cutoff = fourWeeksAgo.toISOString().split('T')[0]

    return Array.from(stats.entries()).map(([name, { dates, sortedDates }]) => {
      const recentDates = [...dates].filter((d) => d >= cutoff)
      const workoutsPerWeek = Math.round(recentDates.length / 4 * 10) / 10

      // Calculate streak
      let streak = 0
      const sorted = sortedDates.sort((a, b) => b.localeCompare(a))
      const today = now.toISOString().split('T')[0]
      let checkDate = today
      for (const d of sorted) {
        if (d === checkDate || d === getPrevDay(checkDate)) {
          streak++
          checkDate = d
        } else if (d < checkDate) {
          break
        }
      }

      return { name, workoutsPerWeek, totalWorkouts: dates.size, currentStreak: streak }
    }).sort((a, b) => b.workoutsPerWeek - a.workoutsPerWeek)
  }, [allLogs, isShared])

  return {
    logs, allLogs, myLogs, isLoading, refresh,
    workoutDates, exerciseHistory, personalRecords, uniqueExercises,
    athletes, isShared, selectedAthlete, setSelectedAthlete,
    leaderboard, athleteStats,
  }
}

function getPrevDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
