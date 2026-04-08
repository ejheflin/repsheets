interface FinishWorkoutSheetProps {
  uncheckedCount: number
  onLogCompleted: () => void
  onCompleteAll: () => void
  onCancel: () => void
}

export function FinishWorkoutSheet({
  uncheckedCount, onLogCompleted, onCompleteAll, onCancel,
}: FinishWorkoutSheetProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50">
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5">
        <div className="text-center mb-4">
          <div className="text-base font-bold">Finish Workout?</div>
          <div className="text-xs text-gray-400 mt-1">
            {uncheckedCount} of your exercises are unchecked
          </div>
        </div>
        <button onClick={onLogCompleted}
          className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold mb-2 text-sm">
          Log Completed Only
        </button>
        <button onClick={onCompleteAll}
          className="w-full bg-[#2a2a4a] rounded-[10px] p-3 text-center font-semibold mb-2 text-sm">
          Complete All & Log
        </button>
        <button onClick={onCancel}
          className="w-full p-3 text-center text-gray-500 font-semibold text-sm">Cancel</button>
      </div>
    </div>
  )
}
