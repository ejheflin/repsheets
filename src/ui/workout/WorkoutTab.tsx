import { useState, useEffect, useMemo } from 'react'
import { ExerciseRow } from './ExerciseRow'
import { SupersetGroup } from './SupersetGroup'
import { FinishWorkoutSheet } from './FinishWorkoutSheet'
import { RoutineUpdatePrompt } from './RoutineUpdatePrompt'
import { useWorkout } from '../../data/useWorkout'
import { useLogs } from '../../data/useLogs'
import { useSheetContext } from '../../data/useSheetContext'
import { useAuth } from '../../auth/useAuth'
import { listRepSheets } from '../../sheets/driveApi'
import { estimateOneRepMax } from '../../workout/oneRepMax'
import type { WorkoutExercise } from '../../types'

interface WorkoutTabProps {
  onGoToRoutines: () => void
}

export function WorkoutTab({ onGoToRoutines }: WorkoutTabProps) {
  const {
    workout, toggleSet, toggleExercise, updateSet, updateAllSets, updateNotes,
    toggleExpanded, addSet, finishWorkout, discardWorkout,
  } = useWorkout()
  const { spreadsheetId } = useSheetContext()
  const { user } = useAuth()
  const { myLogs } = useLogs()
  const [showFinish, setShowFinish] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [routineUpdateExercises, setRoutineUpdateExercises] = useState<WorkoutExercise[] | null>(null)

  const athleteName = useMemo(() => {
    if (!user) return ''
    const parts = user.name.trim().split(/\s+/)
    if (parts.length < 2) return parts[0] || ''
    return `${parts[0]} ${parts[parts.length - 1][0]}`
  }, [user])

  const oneRepMaxMap = useMemo(() => {
    const map = new Map<string, number | null>()
    if (!workout) return map
    for (const ex of workout.exercises) {
      if (ex.sets.some((s) => s.pct !== null)) {
        map.set(ex.exercise, estimateOneRepMax(myLogs, ex.exercise, athleteName))
      }
    }
    return map
  }, [workout, myLogs, athleteName])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!workout) {
    return (
      <div className="text-center mt-20">
        <p className="text-gray-400">No workout in progress.</p>
        <p className="text-gray-500 text-sm mt-2">Pick a <button onClick={onGoToRoutines} className="text-[#6c63ff] underline">routine</button> to get started.</p>
      </div>
    )
  }

  const allChecked = workout.exercises.every((ex) => ex.sets.every((s) => s.completed))

  const doFinish = async (logOnlyCompleted: boolean) => {
    const result = await finishWorkout(logOnlyCompleted)
    setShowFinish(false)
    if (result && result.exercisesWithAddedSets.length > 0 && spreadsheetId) {
      // Only prompt to update routine if the user owns the sheet
      try {
        const sheets = await listRepSheets()
        const activeSheet = sheets.find((s) => s.spreadsheetId === spreadsheetId)
        if (activeSheet?.isOwner) {
          setRoutineUpdateExercises(result.exercisesWithAddedSets)
        }
      } catch {
        // If we can't check, skip the prompt
      }
    }
  }

  const handleFinish = () => {
    if (allChecked) {
      doFinish(false)
    } else {
      setShowFinish(true)
    }
  }

  const handleDiscard = async () => {
    await discardWorkout()
    setShowDiscard(false)
  }

  // Group consecutive exercises with the same supersetGroup
  const groups: { supersetGroup: string | null; exerciseIndices: number[] }[] = []
  workout.exercises.forEach((ex, idx) => {
    const last = groups[groups.length - 1]
    if (last && ex.supersetGroup && last.supersetGroup === ex.supersetGroup) {
      last.exerciseIndices.push(idx)
    } else {
      groups.push({ supersetGroup: ex.supersetGroup, exerciseIndices: [idx] })
    }
  })

  return (
    <div>
      <div className={`sticky top-0 z-20 bg-[#1a1a2e] -mx-4 px-4 flex justify-between items-center transition-all duration-200 ${scrolled ? 'pt-2 pb-1.5 mb-1.5' : 'pt-1 pb-2 mb-2'}`}>
        <div className="min-w-0">
          {!scrolled && <div className="text-[11px] text-gray-500">{workout.program}</div>}
          <h1 className={`font-bold truncate transition-all duration-200 ${scrolled ? 'text-[15px]' : 'text-[20px]'}`}>{workout.routine}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowDiscard(true)}
            className={`rounded-md bg-[#2a2a4a] text-red-400 flex items-center justify-center transition-all duration-200 ${scrolled ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'}`}>
            ✕
          </button>
          <button data-tour="finish-button" onClick={handleFinish}
            className={`bg-[#6c63ff] rounded-md font-semibold transition-all duration-200 ${scrolled ? 'px-3 py-1.5 text-xs h-8' : 'px-4 py-2 text-sm h-9'}`}>
            Finish
          </button>
        </div>
      </div>

      {groups.map((group, gIdx) => {
        const content = group.exerciseIndices.map((exIdx) => {
          const ex = workout.exercises[exIdx]
          return (
            <ExerciseRow key={exIdx} exercise={ex}
              oneRepMax={oneRepMaxMap.get(ex.exercise) ?? null}
              onToggleExpand={() => toggleExpanded(exIdx)}
              onToggleExercise={() => toggleExercise(exIdx)}
              onToggleSet={(setIdx) => toggleSet(exIdx, setIdx)}
              onUpdateSet={(setIdx, field, val) => updateSet(exIdx, setIdx, field, val)}
              onUpdateAllSets={(field, val) => updateAllSets(exIdx, field, val)}
              onUpdateNotes={(notes) => updateNotes(exIdx, notes)}
              onAddSet={() => addSet(exIdx)}
              tourId={exIdx === 0 ? 'first-exercise' : undefined} />
          )
        })
        return group.supersetGroup ? (
          <SupersetGroup key={gIdx}>{content}</SupersetGroup>
        ) : (
          <div key={gIdx}>{content}</div>
        )
      })}

      {showFinish && (
        <FinishWorkoutSheet
          uncheckedCount={workout.exercises.filter((ex) => !ex.sets.every((s) => s.completed)).length}
          onLogCompleted={() => doFinish(true)}
          onCompleteAll={() => doFinish(false)}
          onCancel={() => setShowFinish(false)} />
      )}

      {routineUpdateExercises && (
        <RoutineUpdatePrompt
          exercises={routineUpdateExercises}
          onUpdate={() => setRoutineUpdateExercises(null)}
          onDismiss={() => setRoutineUpdateExercises(null)} />
      )}

      {showDiscard && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5">
            <p className="text-center font-bold mb-1">Discard Workout?</p>
            <p className="text-center text-gray-400 text-sm mb-4">Your progress will be lost.</p>
            <button onClick={handleDiscard}
              className="w-full bg-red-500 rounded-[10px] p-3 text-center font-semibold mb-2">Discard</button>
            <button onClick={() => setShowDiscard(false)}
              className="w-full p-3 text-center text-gray-400 font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
