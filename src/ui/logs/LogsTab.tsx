import { useMemo, useState } from 'react'
import { useLogs } from '../../data/useLogs'
import { useRoutines } from '../../data/useRoutines'
import { useAuth } from '../../auth/useAuth'
import { AuthExpiredError } from '../../auth/authFetch'
import { CalendarView } from './CalendarView'
import { ExerciseProgressChart } from './ExerciseProgressChart'
import { PersonalRecords } from './PersonalRecords'
import { AthleteFilter } from './AthleteFilter'
import { Leaderboard } from './Leaderboard'

export function LogsTab() {
  const {
    isLoading, workoutDates, exerciseHistory, personalRecords, uniqueExercises,
    athletes, isShared, selectedAthlete, setSelectedAthlete,
    leaderboard, athleteStats,
  } = useLogs()
  const { allRows } = useRoutines(null)
  const { login } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const allRoutines = useMemo(() => {
    return [...new Set(allRows.map((r) => r.routine))]
  }, [allRows])

  const programExercises = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const row of allRows) {
      if (!map.has(row.program)) map.set(row.program, [])
      const exercises = map.get(row.program)!
      if (!exercises.includes(row.exercise)) exercises.push(row.exercise)
    }
    return map
  }, [allRows])

  const programs = useMemo(() => {
    return [...new Set(allRows.map((r) => r.program))].filter(Boolean)
  }, [allRows])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } catch (e) {
      if (e instanceof AuthExpiredError) {
        login()
      }
    }
    setIsRefreshing(false)
  }

  if (isLoading) {
    return <div className="text-gray-400 text-center mt-10">Loading logs...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-[20px] font-bold">Logs</h1>
        <button onClick={handleRefresh} disabled={isRefreshing}
          className={`text-gray-500 p-1.5 active:text-[#6c63ff] transition ${isRefreshing ? 'animate-spin' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
      </div>

      {isShared && (
        <div className="mb-3">
          <AthleteFilter athletes={athletes} selected={selectedAthlete} onSelect={setSelectedAthlete} />
        </div>
      )}

      <div className="space-y-3">
        <CalendarView workoutDates={workoutDates} allRoutines={allRoutines} />
        <ExerciseProgressChart exerciseHistory={exerciseHistory} uniqueExercises={uniqueExercises} programs={programs} programExercises={programExercises} />
        <PersonalRecords records={personalRecords} />
        {isShared && <Leaderboard leaderboard={leaderboard} athleteStats={athleteStats} />}
      </div>
    </div>
  )
}
