import { SetRow } from './SetRow'
import type { WorkoutExercise } from '../../types'

interface ExerciseRowProps {
  exercise: WorkoutExercise
  onToggleExpand: () => void
  onToggleExercise: () => void
  onToggleSet: (setIdx: number) => void
  onUpdateSet: (setIdx: number, field: 'reps' | 'value', val: number | null) => void
  onAddSet: () => void
}

function summarizeSets(exercise: WorkoutExercise): string {
  const sets = exercise.sets
  if (sets.length === 0) return ''
  const firstReps = sets[0].reps
  const firstValue = sets[0].value
  const unit = sets[0].unit
  const allSame = sets.every((s) => s.reps === firstReps && s.value === firstValue)
  if (allSame && firstReps !== null) {
    const valStr = firstValue !== null ? ` @ ${firstValue} ${unit}` : ''
    return `${sets.length}×${firstReps}${valStr}`
  }
  return `${sets.length} sets`
}

export function ExerciseRow({
  exercise,
  onToggleExpand, onToggleExercise, onToggleSet, onUpdateSet, onAddSet,
}: ExerciseRowProps) {
  const allCompleted = exercise.sets.every((s) => s.completed)
  const summary = summarizeSets(exercise)
  const unit = exercise.sets[0]?.unit ?? ''

  if (!exercise.isExpanded) {
    return (
      <div className="bg-[#2a2a4a] rounded-[10px] mb-1.5 px-3 py-2.5 flex items-center">
        <button onClick={onToggleExpand} className="text-gray-500 mr-2 text-xs">▶</button>
        <button onClick={onToggleExpand} className="flex-1 text-left">
          <div className="font-semibold text-sm">{exercise.exercise}</div>
          <div className="text-xs text-gray-500 mt-0.5">{summary}</div>
          {exercise.notes && (
            <div className="text-[10px] text-yellow-400 mt-0.5">💡 {exercise.notes}</div>
          )}
        </button>
        <button onClick={onToggleExercise}>
          {allCompleted ? (
            <div className="w-[22px] h-[22px] bg-[#6c63ff] rounded-md flex items-center justify-center text-xs">✓</div>
          ) : (
            <div className="w-[22px] h-[22px] border-2 border-[#444] rounded-md" />
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] mb-1.5 px-3 py-2.5">
      <div className="flex items-center mb-2">
        <button onClick={onToggleExpand} className="text-gray-500 mr-2 text-xs">▼</button>
        <div className="flex-1 font-bold text-[15px]">{exercise.exercise}</div>
        <button onClick={onToggleExercise}>
          {allCompleted ? (
            <div className="w-[22px] h-[22px] bg-[#6c63ff] rounded-md flex items-center justify-center text-xs">✓</div>
          ) : (
            <div className="w-[22px] h-[22px] border-2 border-[#444] rounded-md" />
          )}
        </button>
      </div>
      {exercise.notes && (
        <div className="text-[10px] text-yellow-400 mb-2 ml-5">💡 {exercise.notes}</div>
      )}
      <div className="ml-5">
        <div className="flex pb-1 text-[10px] text-gray-600 uppercase tracking-wider">
          <div className="w-7">Set</div>
          <div className="flex-1 text-center">Reps</div>
          <div className="flex-1 text-center">{unit || 'Value'}</div>
          <div className="w-7" />
        </div>
        {exercise.sets.map((set, setIdx) => (
          <SetRow key={set.setNumber} setNumber={set.setNumber} reps={set.reps}
            value={set.value} unit={unit} completed={set.completed}
            onToggle={() => onToggleSet(setIdx)}
            onRepsChange={(v) => onUpdateSet(setIdx, 'reps', v)}
            onValueChange={(v) => onUpdateSet(setIdx, 'value', v)} />
        ))}
        <button onClick={onAddSet}
          className="w-full text-center text-xs text-[#6c63ff] py-2 mt-1 font-semibold">
          + Add Set
        </button>
      </div>
    </div>
  )
}
