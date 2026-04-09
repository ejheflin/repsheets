interface RoutineCardProps {
  name: string
  exercises: string[]
  onTap: () => void
  tourId?: string
}

export function RoutineCard({ name, exercises, onTap, tourId }: RoutineCardProps) {
  const summary = exercises.slice(0, 4).join(', ')
  const extra = exercises.length > 4 ? ` +${exercises.length - 4} more` : ''
  return (
    <button onClick={onTap} data-tour={tourId}
      className="w-full bg-[#2a2a4a] rounded-[10px] p-3.5 mb-2 text-left active:opacity-80 transition">
      <div className="font-semibold text-[15px]">{name}</div>
      <div className="text-[12px] text-gray-500 mt-1">{summary}{extra}</div>
    </button>
  )
}
