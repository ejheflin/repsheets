import { useState, useEffect, useCallback } from 'react'
import { ProgramSelector } from './ProgramSelector'
import { RoutineCard } from './RoutineCard'
import { useRoutines } from '../../data/useRoutines'
import { useWorkout } from '../../data/useWorkout'
import { getPreference, setPreference } from '../../data/db'
import { useSheetContext } from '../../data/useSheetContext'
import { SheetSwitcherModal } from '../SheetSwitcherModal'
import type { RoutineRow } from '../../types'

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

  const setSelectedProgram = useCallback((program: string) => {
    setSelectedProgramState(program)
    setPreference('activeProgram', program)
  }, [])
  const { routineList, programs, isLoading } = useRoutines(selectedProgram || null)
  const { workout, startWorkout, discardWorkout } = useWorkout()
  const { spreadsheetId } = useSheetContext()
  const [showSheetSwitcher, setShowSheetSwitcher] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState<{
    program: string; routine: string; rows: RoutineRow[]
  } | null>(null)

  // Load saved preference once on mount
  useEffect(() => {
    getPreference('activeProgram').then((saved) => {
      setSavedProgram(saved ?? null)
      setPrefLoaded(true)
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

  const handleRoutineTap = (routine: { name: string; rows: RoutineRow[] }) => {
    if (workout) {
      setConfirmDiscard({ program: selectedProgram, routine: routine.name, rows: routine.rows })
      return
    }
    startWorkout(selectedProgram, routine.name, routine.rows)
    onStartWorkout()
  }

  const handleConfirmDiscard = async () => {
    if (!confirmDiscard) return
    await discardWorkout()
    await startWorkout(confirmDiscard.program, confirmDiscard.routine, confirmDiscard.rows)
    setConfirmDiscard(null)
    onStartWorkout()
  }

  if (isLoading) {
    return <div className="text-gray-400 text-center mt-10">Loading routines...</div>
  }

  return (
    <div>
      <div className="flex items-stretch gap-2 mb-4">
        <button onClick={() => setShowSheetSwitcher(true)}
          className="w-12 rounded-[10px] bg-[#2a2a4a] border border-[#3a3a5a] flex items-center justify-center flex-shrink-0 active:opacity-80">
          <SheetIcon />
        </button>
        {programs.length > 1 ? (
          <div className="flex-1">
            <ProgramSelector programs={programs} selected={selectedProgram} onSelect={setSelectedProgram} />
          </div>
        ) : (
          <h1 className="text-[20px] font-bold flex-1">Routines</h1>
        )}
      </div>
      {programs.length > 1 && <h1 className="text-[20px] font-bold mb-3">Routines</h1>}
      {routineList.length === 0 ? (
        <p className="text-gray-500 text-sm">No routines found for this program.</p>
      ) : (
        routineList.map((r) => (
          <RoutineCard key={r.name} name={r.name} exercises={r.exercises}
            onTap={() => handleRoutineTap(r)} />
        ))
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
