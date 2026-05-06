import { useRef, useEffect } from 'react'

interface SetRowProps {
  setNumber: number
  reps: number | null
  value: number | null
  unit: string
  completed: boolean
  pct?: number | null
  oneRepMax?: number | null
  repsFlag?: boolean
  valueFlag?: boolean
  onToggle: () => void
  onRepsChange: (val: number | null) => void
  onValueChange: (val: number | null) => void
  onTargetClick?: () => void
}

export function SetRow({
  setNumber, reps, value, unit: _unit, completed,
  pct, oneRepMax,
  repsFlag, valueFlag,
  onToggle, onRepsChange, onValueChange, onTargetClick,
}: SetRowProps) {
  const showPctLabel = pct != null
  const targetWeight = showPctLabel && oneRepMax != null
    ? Math.round(pct * oneRepMax / 100 / 5) * 5
    : null

  const pctLabel = showPctLabel
    ? targetWeight != null ? `${Math.round(pct!)}%/${targetWeight}` : `${Math.round(pct!)}%`
    : null

  const valueRef = useRef<HTMLInputElement>(null)
  const prevValue = useRef(value)
  const valueUserTyped = useRef(false)
  useEffect(() => {
    const prev = prevValue.current
    prevValue.current = value
    if (value != null && prev == null && !valueUserTyped.current && document.activeElement === valueRef.current) {
      valueRef.current?.select()
    }
    valueUserTyped.current = false
  }, [value])

  return (
    <div className="flex items-center py-1.5 bg-[#2a2a4a]">
      <div className="w-7 text-xs text-gray-500">{setNumber}</div>
      <div className="flex-1 flex items-center justify-center gap-1">
        <button
          onClick={() => onRepsChange(Math.max(0, (reps ?? 0) - 1))}
          className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#2a2a4a]"
        >−</button>
        <input type="text" inputMode="numeric" value={reps ?? ''}
          onChange={(e) => onRepsChange(e.target.value ? Number(e.target.value) : null)}
          onFocus={(e) => e.target.select()}
          className={`w-12 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${repsFlag ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
          placeholder="—" />
        <button
          onClick={() => onRepsChange((reps ?? 0) + 1)}
          className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#2a2a4a]"
        >+</button>
      </div>
      {pctLabel != null && (
        <button onClick={onTargetClick}
          className="w-16 text-right pr-1 text-[11px] text-gray-500 leading-tight flex-shrink-0 active:opacity-80">
          {pctLabel}
        </button>
      )}
      <div className="flex-1 text-center">
        <input ref={valueRef} type="text" inputMode="decimal" value={value != null ? Math.round(value) : ''}
          onChange={(e) => { valueUserTyped.current = true; onValueChange(e.target.value ? Number(e.target.value) : null) }}
          onFocus={(e) => e.target.select()}
          className={`w-16 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${valueFlag ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
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
