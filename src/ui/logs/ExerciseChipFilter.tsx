interface ExerciseChipFilterProps {
  exercises: string[]
  selected: Set<string>
  onToggle: (exercise: string) => void
}

export function ExerciseChipFilter({ exercises, selected, onToggle }: ExerciseChipFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
      {exercises.map((ex) => (
        <button key={ex} onClick={() => onToggle(ex)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition ${
            selected.has(ex) ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400'
          }`}>
          {ex}
        </button>
      ))}
    </div>
  )
}
