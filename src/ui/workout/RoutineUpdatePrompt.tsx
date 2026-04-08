import type { WorkoutExercise } from '../../types'

interface RoutineUpdatePromptProps {
  exercises: WorkoutExercise[]
  onUpdate: () => void
  onDismiss: () => void
}

export function RoutineUpdatePrompt({ exercises, onUpdate, onDismiss }: RoutineUpdatePromptProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50">
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5">
        <div className="text-center mb-4">
          <div className="text-base font-bold">Update Routine?</div>
          <div className="text-xs text-gray-400 mt-2">
            {exercises.map((ex) => (
              <p key={ex.exercise}>
                You logged {ex.sets.length} sets of {ex.exercise} but your routine differs.
              </p>
            ))}
          </div>
        </div>
        <button onClick={onUpdate}
          className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold mb-2 text-sm">
          Update Routine
        </button>
        <button onClick={onDismiss}
          className="w-full p-3 text-center text-gray-500 font-semibold text-sm">
          Keep As-Is
        </button>
      </div>
    </div>
  )
}
