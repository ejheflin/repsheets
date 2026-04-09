import { useMemo } from 'react'
import { useLogs } from '../../data/useLogs'
import { useRoutines } from '../../data/useRoutines'
import { CalendarView } from './CalendarView'
import { ExerciseProgressChart } from './ExerciseProgressChart'
import { PersonalRecords } from './PersonalRecords'

export function LogsTab() {
  const { isLoading, workoutDates, exerciseHistory, personalRecords, uniqueExercises } = useLogs()
  const { allRows } = useRoutines(null)

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

  if (isLoading) {
    return <div className="text-gray-400 text-center mt-10">Loading logs...</div>
  }

  return (
    <div>
      <h1 className="text-[20px] font-bold mb-3">Logs</h1>
      <div className="space-y-3">
        <CalendarView workoutDates={workoutDates} allRoutines={allRoutines} />
        <ExerciseProgressChart exerciseHistory={exerciseHistory} uniqueExercises={uniqueExercises} programs={programs} programExercises={programExercises} />
        <PersonalRecords records={personalRecords} />
      </div>
    </div>
  )
}
