import { useMemo, useState } from 'react'
import { useLogs } from '../../data/useLogs'
import { useRoutines } from '../../data/useRoutines'
import { useAuth } from '../../auth/useAuth'
import { AuthExpiredError } from '../../auth/authFetch'
import { CalendarView } from './CalendarView'
import { ExerciseProgressChart } from './ExerciseProgressChart'
import { PersonalRecords } from './PersonalRecords'
import { AthleteFilter } from './AthleteFilter'
import { LeaderboardChart } from './LeaderboardChart'
import { LogsSettingsModal, loadPaneConfig, type LogsPaneConfig } from './LogsSettingsModal'
import { ImportHevyModal } from './ImportHevyModal'
import { ImportStrongModal } from './ImportStrongModal'
import { flushSync } from '../../data/syncEngine'
import { useSheetContext } from '../../data/useSheetContext'

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}

export function LogsTab() {
  const {
    isLoading, refresh, allLogs, workoutDates, athleteDates,
    exerciseHistory, exerciseHistoryByAthlete, personalRecords,
    uniqueExercises, lastLoggedProgram,
    athletes, isShared, selectedAthlete, setSelectedAthlete,
  } = useLogs()
  const { allRows } = useRoutines(null)
  const { login } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHevyImport, setShowHevyImport] = useState(false)
  const [showStrongImport, setShowStrongImport] = useState(false)
  const [panes, setPanes] = useState<LogsPaneConfig[]>(loadPaneConfig)

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
      if (spreadsheetId) await flushSync(spreadsheetId)
      await refresh()
    } catch (e) {
      if (e instanceof AuthExpiredError) {
        login()
      }
    }
    setIsRefreshing(false)
  }

  const isPaneEnabled = (id: string) => {
    const pane = panes.find((p) => p.id === id)
    return pane ? pane.enabled : true
  }

  const renderPane = (id: string) => {
    if (!isPaneEnabled(id)) return null

    switch (id) {
      case 'calendar':
        return <CalendarView key={id} workoutDates={workoutDates} athleteDates={athleteDates} allRoutines={allRoutines} allAthletes={athletes} />
      case 'progress':
        return (
          <ExerciseProgressChart key={id}
            exerciseHistory={exerciseHistory}
            exerciseHistoryByAthlete={exerciseHistoryByAthlete}
            uniqueExercises={uniqueExercises}
            programs={programs}
            programExercises={programExercises}
            lastLoggedProgram={lastLoggedProgram}
            isShared={isShared}
            showAllAthletes={selectedAthlete === '__all__'}
          />
        )
      case 'records':
        return <PersonalRecords key={id} records={personalRecords} />
      case 'leaderboard':
        return isShared ? <LeaderboardChart key={id} allLogs={allLogs} athletes={athletes} /> : null
      default:
        return null
    }
  }

  if (isLoading) {
    return <div className="text-gray-400 text-center mt-10">Loading logs...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-[20px] font-bold">Logs</h1>
        <div className="flex items-center gap-1">
          <button onClick={handleRefresh} disabled={isRefreshing}
            className={`text-gray-500 p-1.5 active:text-[#6c63ff] transition ${isRefreshing ? 'animate-spin' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
          <button onClick={() => setShowSettings(true)}
            className="text-gray-500 p-1.5 active:text-[#6c63ff] transition">
            <SettingsIcon />
          </button>
        </div>
      </div>

      {isShared && (
        <div className="sticky top-0 z-10 bg-[#1a1a2e] -mx-4 px-4 pb-2 mb-1">
          <AthleteFilter athletes={athletes} selected={selectedAthlete} onSelect={setSelectedAthlete} />
        </div>
      )}

      <div className="space-y-3">
        {panes.map((pane) => renderPane(pane.id))}
      </div>

      <div className="flex justify-center gap-4 mt-4 py-2">
        <button onClick={() => setShowHevyImport(true)} className="text-xs text-[#6c63ff]">
          Import from HEVY
        </button>
        <button onClick={() => setShowStrongImport(true)} className="text-xs text-[#6c63ff]">
          Import from Strong
        </button>
      </div>

      {showSettings && (
        <LogsSettingsModal panes={panes} onChange={setPanes} onClose={() => setShowSettings(false)} />
      )}
      {showHevyImport && (
        <ImportHevyModal onClose={() => setShowHevyImport(false)} onDone={refresh} />
      )}
      {showStrongImport && (
        <ImportStrongModal onClose={() => setShowStrongImport(false)} onDone={refresh} />
      )}
    </div>
  )
}
