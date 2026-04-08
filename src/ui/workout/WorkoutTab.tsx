import { useState, useEffect } from 'react'
import { ExerciseRow } from './ExerciseRow'
import { SupersetGroup } from './SupersetGroup'
import { FinishWorkoutSheet } from './FinishWorkoutSheet'
import { useWorkout } from '../../data/useWorkout'

interface WorkoutTabProps {
  onGoToRoutines: () => void
}

export function WorkoutTab({ onGoToRoutines }: WorkoutTabProps) {
  const {
    workout, toggleSet, toggleExercise, updateSet, updateAllSets, updateNotes,
    toggleExpanded, addSet, finishWorkout, discardWorkout,
  } = useWorkout()
  const [showFinish, setShowFinish] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [scrolled, setScrolled] = useState(false)

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

  const handleFinish = () => {
    if (allChecked) {
      finishWorkout(false)
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
      <div className={`sticky top-8 z-20 bg-[#1a1a2e] -mx-4 px-4 flex justify-between items-center transition-all duration-200 ${scrolled ? 'py-1.5 mb-1.5' : 'py-2 mb-2'}`}>
        <div className="min-w-0">
          {!scrolled && <div className="text-[11px] text-gray-500">{workout.program}</div>}
          <h1 className={`font-bold truncate transition-all duration-200 ${scrolled ? 'text-[15px]' : 'text-[20px]'}`}>{workout.routine}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowDiscard(true)}
            className={`rounded-md bg-[#2a2a4a] text-red-400 flex items-center justify-center transition-all duration-200 ${scrolled ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'}`}>
            ✕
          </button>
          <button onClick={handleFinish}
            className={`bg-[#6c63ff] rounded-md font-semibold transition-all duration-200 ${scrolled ? 'px-3 py-1.5 text-xs h-8' : 'px-4 py-2 text-sm h-9'}`}>
            Finish
          </button>
        </div>
      </div>

      {groups.map((group, gIdx) => {
        const content = group.exerciseIndices.map((exIdx) => (
          <ExerciseRow key={exIdx} exercise={workout.exercises[exIdx]}
            onToggleExpand={() => toggleExpanded(exIdx)}
            onToggleExercise={() => toggleExercise(exIdx)}
            onToggleSet={(setIdx) => toggleSet(exIdx, setIdx)}
            onUpdateSet={(setIdx, field, val) => updateSet(exIdx, setIdx, field, val)}
            onUpdateAllSets={(field, val) => updateAllSets(exIdx, field, val)}
            onUpdateNotes={(notes) => updateNotes(exIdx, notes)}
            onAddSet={() => addSet(exIdx)} />
        ))
        return group.supersetGroup ? (
          <SupersetGroup key={gIdx}>{content}</SupersetGroup>
        ) : (
          <div key={gIdx}>{content}</div>
        )
      })}

      {showFinish && (
        <FinishWorkoutSheet
          uncheckedCount={workout.exercises.filter((ex) => !ex.sets.every((s) => s.completed)).length}
          onLogCompleted={() => { finishWorkout(true); setShowFinish(false) }}
          onCompleteAll={() => { finishWorkout(false); setShowFinish(false) }}
          onCancel={() => setShowFinish(false)} />
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
