import { useMemo } from 'react'
import { useLogs } from '../../data/useLogs'
import { useRoutines } from '../../data/useRoutines'
import { CalendarView } from './CalendarView'
import { RoutineBalance } from './RoutineBalance'
import { ExerciseProgressChart } from './ExerciseProgressChart'
import { PersonalRecords } from './PersonalRecords'

export function LogsTab() {
  const { isLoading, workoutDates, routineFrequency, exerciseHistory, personalRecords, uniqueExercises } = useLogs()
  const { allRows } = useRoutines(null)

  const allRoutines = useMemo(() => {
    return [...new Set(allRows.map((r) => r.routine))]
  }, [allRows])

  if (isLoading) {
    return <div className="text-gray-400 text-center mt-10">Loading logs...</div>
  }

  return (
    <div>
      <h1 className="text-[20px] font-bold mb-3">Logs</h1>
      <div className="space-y-3">
        <CalendarView workoutDates={workoutDates} allRoutines={allRoutines} />
        <RoutineBalance routineFrequency={routineFrequency} allRoutines={allRoutines} />
        <ExerciseProgressChart exerciseHistory={exerciseHistory} uniqueExercises={uniqueExercises} />
        <PersonalRecords records={personalRecords} />
      </div>
    </div>
  )
}
