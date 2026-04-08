import { useState } from 'react'
import { ExerciseRow } from './ExerciseRow'
import { SupersetGroup } from './SupersetGroup'
import { FinishWorkoutSheet } from './FinishWorkoutSheet'
import { useWorkout } from '../../data/useWorkout'

export function WorkoutTab() {
  const {
    workout, toggleSet, toggleExercise, updateSet,
    toggleExpanded, addSet, finishWorkout, discardWorkout,
  } = useWorkout()
  const [showFinish, setShowFinish] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)

  if (!workout) {
    return (
      <div className="text-center mt-20">
        <p className="text-gray-400">No workout in progress.</p>
        <p className="text-gray-500 text-sm mt-2">Pick a routine to get started.</p>
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
      <div className="flex justify-between items-center mb-2">
        <div>
          <div className="text-[11px] text-gray-500">{workout.routine}</div>
          <h1 className="text-[20px] font-bold">Workout</h1>
        </div>
        <button onClick={() => setShowDiscard(true)}
          className="text-xs text-red-400 font-semibold flex items-center gap-1">
          ✕ Discard
        </button>
      </div>

      {groups.map((group, gIdx) => {
        const content = group.exerciseIndices.map((exIdx) => (
          <ExerciseRow key={exIdx} exercise={workout.exercises[exIdx]} exerciseIdx={exIdx}
            onToggleExpand={() => toggleExpanded(exIdx)}
            onToggleExercise={() => toggleExercise(exIdx)}
            onToggleSet={(setIdx) => toggleSet(exIdx, setIdx)}
            onUpdateSet={(setIdx, field, val) => updateSet(exIdx, setIdx, field, val)}
            onAddSet={() => addSet(exIdx)} />
        ))
        return group.supersetGroup ? (
          <SupersetGroup key={gIdx}>{content}</SupersetGroup>
        ) : (
          <div key={gIdx}>{content}</div>
        )
      })}

      <button onClick={handleFinish}
        className="w-full bg-[#6c63ff] rounded-[10px] py-3 text-center font-bold text-[15px] mt-4">
        Finish Workout
      </button>

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
