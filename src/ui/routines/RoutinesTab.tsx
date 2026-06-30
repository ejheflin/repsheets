import { useState, useEffect, useCallback, useMemo } from 'react'
import { ProgramSelector } from './ProgramSelector'
import { ExpandableRoutineCard, DraftRoutineCard } from './ExpandableRoutineCard'
import { useRoutines } from '../../data/useRoutines'
import { useLogs } from '../../data/useLogs'
import { useWorkout } from '../../data/useWorkout'
import { useAuth } from '../../auth/useAuth'
import { AuthExpiredError } from '../../auth/authFetch'
import { getPreference, setPreference } from '../../data/db'
import { useSheetContext } from '../../data/useSheetContext'
import { SheetSwitcherModal } from '../SheetSwitcherModal'
import { ShareCopyModal } from '../sharing/ShareModal'
import type { RoutineRow } from '../../types'

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function SheetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

interface RoutinesTabProps {
  onStartWorkout: () => void
}

export function RoutinesTab({ onStartWorkout }: RoutinesTabProps) {
  const [selectedProgram, setSelectedProgramState] = useState<string>('')
  const [savedProgram, setSavedProgram] = useState<string | null>(null)
  const [prefLoaded, setPrefLoaded] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftName, setDraftName] = useState('New Routine')
  const [unitSystem, setUnitSystemState] = useState<'imperial' | 'metric'>('imperial')
  const weightUnit = unitSystem === 'metric' ? 'kg' : 'lbs'

  const setUnitSystem = useCallback((sys: 'imperial' | 'metric') => {
    setUnitSystemState(sys)
    setPreference('unitSystem', sys)
  }, [])

  const setSelectedProgram = useCallback((program: string) => {
    setSelectedProgramState(program)
    setPreference('activeProgram', program)
  }, [])
  const { routineList, programs, isLoading, refresh, mutateCache, allRows } = useRoutines(selectedProgram || null)
  const { allLogs } = useLogs()
  const loggedExercises = useMemo(() => [...new Set(allLogs.map((l) => l.exercise))].filter(Boolean), [allLogs])
  const { workout, startWorkout, discardWorkout } = useWorkout()
  const { spreadsheetId } = useSheetContext()
  const { login } = useAuth()
  const [showSheetSwitcher, setShowSheetSwitcher] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState<{
    program: string; routine: string; rows: RoutineRow[]
  } | null>(null)

  // Load saved preference once on mount
  useEffect(() => {
    getPreference('activeProgram').then((saved) => {
      setSavedProgram(saved ?? null)
      setPrefLoaded(true)
    })
    getPreference('unitSystem').then((u) => {
      if (u === 'metric' || u === 'imperial') setUnitSystemState(u)
    })
  }, [])

  // Once both preference and programs are available, reconcile
  useEffect(() => {
    if (!prefLoaded || programs.length === 0) return
    if (selectedProgram && programs.includes(selectedProgram)) return

    if (savedProgram && programs.includes(savedProgram)) {
      setSelectedProgramState(savedProgram)
    } else {
      setSelectedProgram(programs[0])
    }
  }, [prefLoaded, programs, savedProgram, selectedProgram, setSelectedProgram])

  const handleStartWorkout = (rows: RoutineRow[]) => {
    const program = rows[0]?.program ?? selectedProgram
    const routineName = rows[0]?.routine ?? ''
    if (workout) {
      setConfirmDiscard({ program, routine: routineName, rows })
      return
    }
    startWorkout(program, routineName, rows)
    onStartWorkout()
  }

  const handleConfirmDiscard = async () => {
    if (!confirmDiscard) return
    await discardWorkout()
    await startWorkout(confirmDiscard.program, confirmDiscard.routine, confirmDiscard.rows)
    setConfirmDiscard(null)
    onStartWorkout()
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } catch (e) {
      if (e instanceof AuthExpiredError) login()
    }
    setIsRefreshing(false)
  }

  const handleDraftSaved = useCallback(() => {
    refresh().catch(() => {})
  }, [refresh])

  if (isLoading) {
    return <div className="text-gray-400 text-center mt-10">Loading routines...</div>
  }

  return (
    <div>
      <div className="flex items-stretch gap-2 mb-4">
        <button data-tour="sheet-switcher" onClick={() => setShowSheetSwitcher(true)}
          className="w-12 rounded-[10px] bg-[#2a2a4a] border border-[#3a3a5a] flex items-center justify-center flex-shrink-0 active:opacity-80">
          <SheetIcon />
        </button>
        <ProgramSelector programs={programs} selected={selectedProgram} onSelect={setSelectedProgram} />
        <button onClick={handleRefresh} disabled={isRefreshing}
          className={`w-12 rounded-[10px] bg-[#2a2a4a] border border-[#3a3a5a] flex items-center justify-center flex-shrink-0 active:opacity-80 ${isRefreshing ? 'animate-spin' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
        <button onClick={() => setShowShare(true)}
          className="w-12 rounded-[10px] bg-[#2a2a4a] border border-[#3a3a5a] flex items-center justify-center flex-shrink-0 active:opacity-80">
          <ShareIcon />
        </button>
      </div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[20px] font-bold">Routines</h1>
        <div className="flex items-center rounded-[8px] border border-[#3a3a5a] overflow-hidden">
          {(['imperial', 'metric'] as const).map((sys) => (
            <button
              key={sys}
              onClick={() => setUnitSystem(sys)}
              className={`px-2.5 py-1 text-[11px] font-semibold active:opacity-80 ${
                unitSystem === sys ? 'bg-[#6c63ff] text-white' : 'text-gray-400'
              }`}
            >
              {sys === 'imperial' ? 'LB' : 'KG'}
            </button>
          ))}
        </div>
      </div>
      {routineList
        .filter((r) => !hasDraft || r.name.trim().toLowerCase() !== draftName.trim().toLowerCase())
        .map((r, i) => (
          <ExpandableRoutineCard
            key={r.name}
            routine={r}
            spreadsheetId={spreadsheetId ?? ''}
            allRows={allRows}
            loggedExercises={loggedExercises}
            mutateCache={mutateCache}
            onStartWorkout={handleStartWorkout}
            tourId={i === 0 ? 'routine-card' : undefined}
            weightUnit={weightUnit}
          />
        ))}
      {hasDraft && spreadsheetId && (
        <DraftRoutineCard
          program={selectedProgram || programs[0] || ''}
          spreadsheetId={spreadsheetId}
          allRows={allRows}
          loggedExercises={loggedExercises}
          mutateCache={mutateCache}
          onSavedToList={handleDraftSaved}
          onNameChange={setDraftName}
          weightUnit={weightUnit}
        />
      )}
      {!hasDraft && (
        <button
          onClick={() => { setDraftName('New Routine'); setHasDraft(true) }}
          className="w-full mt-2 rounded-[10px] border border-dashed border-[#3a3a5a] bg-transparent flex items-center justify-center py-3 text-[#6c63ff] text-sm font-semibold active:opacity-80"
        >
          + Add routine
        </button>
      )}
      {spreadsheetId && (
        <a
          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs text-[#6c63ff] mt-4 py-2"
        >
          Open Google Sheet
        </a>
      )}
      {showSheetSwitcher && (
        <SheetSwitcherModal onClose={() => setShowSheetSwitcher(false)} />
      )}
      {showShare && (
        <ShareCopyModal program={selectedProgram || programs[0] || ''} onClose={() => setShowShare(false)} />
      )}
      {confirmDiscard && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5">
            <p className="text-center font-bold mb-1">Workout in Progress</p>
            <p className="text-center text-gray-400 text-sm mb-4">
              Discard current workout and start {confirmDiscard.routine}?
            </p>
            <button onClick={handleConfirmDiscard}
              className="w-full bg-red-500 rounded-[10px] p-3 text-center font-semibold mb-2">
              Discard & Start New
            </button>
            <button onClick={() => setConfirmDiscard(null)}
              className="w-full p-3 text-center text-gray-400 font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
