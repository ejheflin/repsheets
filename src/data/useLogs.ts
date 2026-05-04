import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from './useSheetContext'
import { useAlias } from './AliasProvider'
import { fetchLogEntries } from '../sheets/sheetsApi'
import { saveLogs, getLogs } from './db'
import { AuthExpiredError } from '../auth/authFetch'
import { localDateString } from '../utils'
import type { LogEntry } from '../types'

export interface ExerciseHistoryPoint {
  date: string
  maxWeight: number
  estimatedOrm?: number | null
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
  const { alias } = useAlias()
  const [allLogs, setAllLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>(['__me__'])

  const refresh = useCallback(async () => {
    if (!spreadsheetId) return
    try {
      const logs = await fetchLogEntries(spreadsheetId)
      await saveLogs(spreadsheetId, logs)
      setAllLogs(logs)
    } catch (e) {
      if (e instanceof AuthExpiredError) throw e
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
      refresh().catch((e) => {
        if (e instanceof AuthExpiredError) throw e
      })
    }
    load()
  }, [spreadsheetId, refresh, user?.accessToken])

  const athleteName = useMemo(() => {
    if (alias) return alias
    if (!user) return null
    const parts = user.name.trim().split(/\s+/)
    if (parts.length < 2) return parts[0] || ''
    return `${parts[0]} ${parts[parts.length - 1][0]}`
  }, [user, alias])

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

  const toggleAthlete = (id: string) => {
    if (id === '__all__') { setSelectedAthletes(['__all__']); return }
    setSelectedAthletes((prev) => {
      const without = prev.filter((a) => a !== '__all__')
      const next = without.includes(id) ? without.filter((a) => a !== id) : [...without, id]
      return next.length === 0 ? ['__all__'] : next
    })
  }

  // Filtered logs based on selected athletes
  const logs = useMemo(() => {
    if (selectedAthletes.includes('__all__')) return allLogs
    const names = new Set<string>()
    for (const sel of selectedAthletes) {
      if (sel === '__me__') {
        if (athleteName) names.add(athleteName)
        if (user?.email) names.add(user.email)
      } else {
        names.add(sel)
      }
    }
    return allLogs.filter((l) => names.has(l.athlete))
  }, [allLogs, selectedAthletes, athleteName, user])

  const workoutDates = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const log of logs) {
      if (!map.has(log.date)) map.set(log.date, [])
      const routines = map.get(log.date)!
      if (!routines.includes(log.routine)) routines.push(log.routine)
    }
    return map
  }, [logs])

  // Athlete workout dates — respects the athlete filter
  const athleteDates = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const log of logs) {
      if (!map.has(log.date)) map.set(log.date, [])
      const athletes = map.get(log.date)!
      if (!athletes.includes(log.athlete)) athletes.push(log.athlete)
    }
    return map
  }, [logs])

  const exerciseHistory = useCallback((exerciseName: string, limit: number = 10): ExerciseHistoryPoint[] => {
    const byDate = new Map<string, { maxWeight: number; maxOrm: number | null }>()
    for (const log of logs) {
      if (log.exercise !== exerciseName || log.value === null || log.value <= 0) continue
      const orm = (log.pct != null && log.pct > 0) ? log.value / (log.pct / 100) : null
      const current = byDate.get(log.date) ?? { maxWeight: 0, maxOrm: null }
      byDate.set(log.date, {
        maxWeight: Math.max(current.maxWeight, log.value),
        maxOrm: orm != null
          ? Math.max(current.maxOrm ?? 0, orm)
          : current.maxOrm,
      })
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-limit)
      .map(([date, { maxWeight, maxOrm }]) => ({
        date,
        maxWeight,
        estimatedOrm: maxOrm != null ? Math.round(maxOrm / 5) * 5 : null,
      }))
  }, [logs])

  // Per-athlete exercise history for multi-athlete chart
  const exerciseHistoryByAthlete = useCallback((exerciseName: string, limit: number = 10) => {
    // Group by date → athlete → max weight
    const byDate = new Map<string, Map<string, number>>()
    for (const log of logs) {
      if (log.exercise !== exerciseName || log.value === null) continue
      if (!byDate.has(log.date)) byDate.set(log.date, new Map())
      const dateMap = byDate.get(log.date)!
      const current = dateMap.get(log.athlete) ?? 0
      if (log.value > current) dateMap.set(log.athlete, log.value)
    }
    const sortedDates = [...byDate.keys()].sort().slice(-limit)
    const athleteNames = [...new Set(logs.filter((l) => l.exercise === exerciseName).map((l) => l.athlete))]
    return {
      dates: sortedDates,
      athletes: athleteNames,
      data: sortedDates.map((date) => {
        const entry: Record<string, string | number | undefined> = { date: date.slice(5) }
        const dateMap = byDate.get(date)!
        for (const a of athleteNames) {
          const val = dateMap.get(a)
          if (val !== undefined) entry[a] = val
        }
        return entry
      }),
    }
  }, [logs])

  // Last logged program (most recent log entry's program)
  const lastLoggedProgram = useMemo(() => {
    if (myLogs.length === 0) return null
    return myLogs[myLogs.length - 1].program
  }, [myLogs])

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
    const cutoff = localDateString(fourWeeksAgo)

    return Array.from(stats.entries()).map(([name, { dates, sortedDates }]) => {
      const recentDates = [...dates].filter((d) => d >= cutoff)
      const workoutsPerWeek = Math.round(recentDates.length / 4 * 10) / 10

      // Calculate streak
      let streak = 0
      const sorted = sortedDates.sort((a, b) => b.localeCompare(a))
      const today = localDateString(now)
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
    workoutDates, athleteDates, exerciseHistory, exerciseHistoryByAthlete,
    personalRecords, uniqueExercises, lastLoggedProgram,
    athletes, isShared, selectedAthletes, toggleAthlete,
    leaderboard, athleteStats, athleteName,
  }
}

function getPrevDay(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return localDateString(new Date(y, mo - 1, d - 1))
}
