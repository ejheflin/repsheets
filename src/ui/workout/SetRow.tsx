interface SetRowProps {
  setNumber: number
  reps: number | null
  value: number | null
  unit: string
  completed: boolean
  onToggle: () => void
  onRepsChange: (val: number | null) => void
  onValueChange: (val: number | null) => void
}

export function SetRow({
  setNumber, reps, value, unit: _unit, completed,
  onToggle, onRepsChange, onValueChange,
}: SetRowProps) {
  return (
    <div className="flex items-center py-1.5 border-b border-[#3a3a5a] last:border-b-0">
      <div className="w-7 text-xs text-gray-500">{setNumber}</div>
      <div className="flex-1 flex items-center justify-center gap-1">
        <button
          onClick={() => onRepsChange(Math.max(0, (reps ?? 0) - 1))}
          className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#2a2a4a]"
        >−</button>
        <input type="text" inputMode="numeric" value={reps ?? ''}
          onChange={(e) => onRepsChange(e.target.value ? Number(e.target.value) : null)}
          onFocus={(e) => e.target.select()}
          className="w-10 bg-[#1a1a2e] rounded text-center text-sm font-semibold py-1 outline-none focus:ring-1 focus:ring-[#6c63ff] [appearance:textfield]"
          placeholder="—" />
        <button
          onClick={() => onRepsChange((reps ?? 0) + 1)}
          className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#2a2a4a]"
        >+</button>
      </div>
      <div className="flex-1 text-center">
        <input type="text" inputMode="decimal" value={value ?? ''}
          onChange={(e) => onValueChange(e.target.value ? Number(e.target.value) : null)}
          onFocus={(e) => e.target.select()}
          className="w-16 bg-[#1a1a2e] rounded text-center text-sm font-semibold py-1 outline-none focus:ring-1 focus:ring-[#6c63ff] [appearance:textfield]"
          placeholder="—" />
      </div>
      <div className="w-7 text-center">
        <button onClick={onToggle}>
          {completed ? (
            <div className="w-[18px] h-[18px] bg-[#6c63ff] rounded inline-flex items-center justify-center text-[10px]">✓</div>
          ) : (
            <div className="w-[18px] h-[18px] border-2 border-[#444] rounded" />
          )}
        </button>
      </div>
    </div>
  )
}
