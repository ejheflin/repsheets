import { useRef, useEffect } from 'react'
import { rpeToPct, rirToPct } from '../../workout/rpe'
import { roundWeight, measureOf } from '../../data/measure'
import { TimeInput } from './TimeInput'

interface SetRowProps {
  setNumber: number
  reps: number | null
  value: number | null
  unit: string
  completed: boolean
  pct?: number | null
  rpe?: number | null
  rir?: number | null
  achievedRpe?: number | null
  achievedRir?: number | null
  gridCols?: string
  showTargetColumn?: boolean
  oneRepMax?: number | null
  rawOneRepMax?: number | null
  repsFlag?: boolean
  valueFlag?: boolean
  onToggle: () => void
  onRepsChange: (val: number | null) => void
  onValueChange: (val: number | null) => void
  onAchievedRpeChange?: (val: number | null) => void
  onAchievedRirChange?: (val: number | null) => void
  onTargetClick?: () => void
}

export function SetRow({
  setNumber, reps, value, unit, completed,
  pct, rpe, rir, achievedRpe, achievedRir, gridCols, showTargetColumn, oneRepMax, rawOneRepMax,
  repsFlag, valueFlag,
  onToggle, onRepsChange, onValueChange, onAchievedRpeChange, onAchievedRirChange, onTargetClick,
}: SetRowProps) {
  // Achieved-RPE capture appears only for RPE/RIR-prescribed sets (or past sets that
  // logged one). The box defaults to the prescription; the athlete nudges it to what
  // they actually hit. Plain weight/% sets never show it (Layer 1 — no clutter).
  const rpeMode = rpe != null || achievedRpe != null
  const rirMode = !rpeMode && (rir != null || achievedRir != null)
  const showAchieved = rpeMode || rirMode
  const achievedValue = rpeMode ? (achievedRpe ?? rpe) : (achievedRir ?? rir)
  const prescribed = rpeMode ? rpe : rir
  const showPctLabel = pct != null
  const targetWeight = showPctLabel && oneRepMax != null
    ? roundWeight(pct * oneRepMax / 100, unit)
    : null

  const showRpeLabel = !showPctLabel && rpe != null
  const showRirLabel = !showPctLabel && rpe == null && rir != null
  const rpeRirTarget = rawOneRepMax != null
    ? showRpeLabel
      ? roundWeight(rpeToPct(reps ?? 1, rpe!) * rawOneRepMax, unit)
      : showRirLabel
        ? roundWeight(rirToPct(reps ?? 1, rir!) * rawOneRepMax, unit)
        : null
    : null

  const pctLabel = showPctLabel
    ? targetWeight != null ? `${Math.round(pct!)}%/${targetWeight}` : `${Math.round(pct!)}%`
    : showRpeLabel
      ? rpeRirTarget != null ? `@${rpe}/${rpeRirTarget}` : `@${rpe}`
      : showRirLabel
        ? rpeRirTarget != null ? `${rir}RIR/${rpeRirTarget}` : `${rir}RIR`
        : null

  const valueRef = useRef<HTMLInputElement>(null)
  const prevValue = useRef(value)
  // True once the user has typed into this field; stays true until they leave and
  // re-enter (onFocus resets it). Prevents the autofill select-on-appear effect from
  // re-selecting and clobbering keystrokes as the user types successive digits.
  const userEditing = useRef(false)
  useEffect(() => {
    const prev = prevValue.current
    prevValue.current = value
    if (value != null && prev == null && !userEditing.current && document.activeElement === valueRef.current) {
      valueRef.current?.select()
    }
  }, [value])

  return (
    <div className="grid items-center py-1.5 bg-[#2a2a4a]" style={{ gridTemplateColumns: gridCols }}>
      <div className="text-xs text-gray-500 text-center">{setNumber}</div>
      <div className="flex items-center justify-center gap-1 min-w-0">
        <button
          onClick={() => onRepsChange(Math.max(0, (reps ?? 0) - 1))}
          className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center flex-shrink-0 active:bg-[#2a2a4a]"
        >−</button>
        <input type="text" inputMode="numeric" value={reps ?? ''}
          onChange={(e) => onRepsChange(e.target.value ? Number(e.target.value) : null)}
          onFocus={(e) => e.target.select()}
          className={`w-full min-w-0 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${repsFlag ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
          placeholder="—" />
        <button
          onClick={() => onRepsChange((reps ?? 0) + 1)}
          className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center flex-shrink-0 active:bg-[#2a2a4a]"
        >+</button>
      </div>
      {showTargetColumn && (
        showPctLabel ? (
          <button onClick={onTargetClick}
            className="text-right pr-1 text-[11px] text-gray-500 leading-tight active:opacity-80 truncate">
            {pctLabel}
          </button>
        ) : showAchieved ? (
          <div className="px-0.5 min-w-0">
            <input type="text" inputMode="decimal"
              value={achievedValue != null ? achievedValue : ''}
              placeholder={prescribed != null ? String(prescribed) : ''}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null
                if (rpeMode) onAchievedRpeChange?.(v)
                else onAchievedRirChange?.(v)
              }}
              onFocus={(e) => e.target.select()}
              className="w-full min-w-0 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] focus:ring-1 focus:ring-[#6c63ff]" />
          </div>
        ) : (
          <div />
        )
      )}
      <div className="px-1 min-w-0">
        {measureOf(unit) === 'time' ? (
          <TimeInput value={value} onChange={onValueChange}
            className={`w-full min-w-0 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${valueFlag ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`} />
        ) : (
          <input ref={valueRef} type="text" inputMode="decimal" value={value != null ? Math.round(value) : ''}
            onChange={(e) => { userEditing.current = true; onValueChange(e.target.value ? Number(e.target.value) : null) }}
            onFocus={(e) => { userEditing.current = false; e.target.select() }}
            className={`w-full min-w-0 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${valueFlag ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
            placeholder="—" />
        )}
      </div>
      <div className="flex justify-center">
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
