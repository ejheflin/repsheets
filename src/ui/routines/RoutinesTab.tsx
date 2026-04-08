import { useState, useEffect, useCallback } from 'react'
import { ProgramSelector } from './ProgramSelector'
import { RoutineCard } from './RoutineCard'
import { useRoutines } from '../../data/useRoutines'
import { useWorkout } from '../../data/useWorkout'
import { getPreference, setPreference } from '../../data/db'
import { useSheetContext } from '../../data/useSheetContext'
import type { RoutineRow } from '../../types'

interface RoutinesTabProps {
  onStartWorkout: () => void
}

export function RoutinesTab({ onStartWorkout }: RoutinesTabProps) {
  const [selectedProgram, setSelectedProgramState] = useState<string>('')
  const [programLoaded, setProgramLoaded] = useState(false)

  const setSelectedProgram = useCallback((program: string) => {
    setSelectedProgramState(program)
    setPreference('activeProgram', program)
  }, [])
  const { routineList, programs, isLoading } = useRoutines(selectedProgram || null)
  const { workout, startWorkout, discardWorkout } = useWorkout()
  const { spreadsheetId } = useSheetContext()
  const [confirmDiscard, setConfirmDiscard] = useState<{
    program: string; routine: string; rows: RoutineRow[]
  } | null>(null)

  useEffect(() => {
    if (!programLoaded) {
      getPreference('activeProgram').then((saved) => {
        if (saved && programs.includes(saved)) {
          setSelectedProgramState(saved)
        } else if (programs.length > 0) {
          setSelectedProgram(programs[0])
        }
        setProgramLoaded(true)
      })
    } else if (programs.length > 0 && !selectedProgram) {
      setSelectedProgram(programs[0])
    }
  }, [programs, selectedProgram, programLoaded, setSelectedProgram])

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
      {programs.length > 1 && (
        <ProgramSelector programs={programs} selected={selectedProgram} onSelect={setSelectedProgram} />
      )}
      <h1 className="text-[20px] font-bold mb-3">Routines</h1>
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
