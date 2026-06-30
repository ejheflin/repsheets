import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRoutineEditor } from '../../data/useRoutineEditor'
import { toEditable } from '../../data/routineModel'
import { formatValue, formatDuration, measureOf, MEASURES } from '../../data/measure'
import { rpeToPct, rirToPct } from '../../workout/rpe'
import { SwipeableRow } from '../shared/SwipeableRow'
import type { Action } from '../../data/routineEditorReducer'
import type { EditableRoutine, RoutineRow, EditableExercise } from '../../types'

function SetTrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

function buildChipSource(
  allRows: RoutineRow[],
  loggedExercises: string[],
  program: string,
  routine: string,
  exercises: EditableRoutine['exercises'],
): string[] {
  const otherRoutineNames = allRows
    .filter((r) => !(r.program === program && r.routine === routine))
    .map((r) => r.exercise)
  const current = new Set(
    exercises.map((e) => e.exercise.trim().toLowerCase()).filter(Boolean)
  )
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of [...otherRoutineNames, ...loggedExercises]) {
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key) || current.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// Small caret used inside the per-exercise card header (mirrors workout ExerciseRow).
function RowChevronRight() {
  return (
    <svg width="8" height="20" viewBox="0 0 8 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 6 6 12 2 18" />
    </svg>
  )
}

function RowChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 4 6 8 10 4" />
    </svg>
  )
}


function buildScheme(ex: EditableRoutine['exercises'][number]): string {
  const setCount = ex.sets.length
  const s0 = ex.sets[0]
  const reps = s0?.reps
  const value = s0?.value
  const parts: string[] = []
  let repsStr: string | null = null
  if (s0?.repsOpen) repsStr = reps != null ? `${reps}+` : 'AMRAP'
  else if (s0?.repsMax != null && reps != null) repsStr = `${reps}-${s0.repsMax}`
  else if (reps != null) repsStr = String(reps)
  if (repsStr != null) {
    parts.push(`${setCount}×${repsStr}`)
  } else {
    parts.push(`${setCount} sets`)
  }
  if (value != null) {
    const formatted = formatValue(value, ex.unit)
    if (formatted) parts.push(formatted)
  } else if (s0?.pct != null) {
    parts.push(`${s0.pct}%`)
  } else if (s0?.rpe != null) {
    parts.push(`@${s0.rpe} RPE`)
  } else if (s0?.rir != null) {
    parts.push(`${s0.rir} RIR`)
  }
  return parts.join(' ')
}

function buildSummaryLine(exercises: EditableRoutine['exercises']): string {
  const MAX_CHARS = 72
  const parts = exercises.map((ex) => `${ex.exercise} ${buildScheme(ex)}`)
  const joined = parts.join(' · ')
  if (joined.length <= MAX_CHARS) return joined
  let acc = ''
  for (let i = 0; i < parts.length; i++) {
    const next = i === 0 ? parts[i] : ` · ${parts[i]}`
    if ((acc + next).length > MAX_CHARS - 1) {
      return acc + '…'
    }
    acc += next
  }
  return acc
}

const stepBtn = 'w-5 h-7 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#2a2a4a] flex-shrink-0'
const boxBase = 'bg-[#1a1a2e] rounded text-center font-semibold py-1 outline-none [appearance:textfield] focus:ring-1 focus:ring-[#6c63ff]'
const headerCls = 'text-[10px] uppercase tracking-wider text-gray-500 text-center pb-1'
const triggerCls = 'text-[10px] uppercase tracking-wider text-[#6c63ff] text-center pb-1 flex items-center justify-center gap-0.5 w-full active:opacity-80'

function CaretDown() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// Shared small anchored dropdown: tap trigger → menu, closes on select / outside-tap.
function Dropdown<T extends string>({
  label,
  current,
  options,
  onSelect,
  width = 'w-44',
}: {
  label: React.ReactNode
  current: T
  options: { value: T; label: string; sub?: string }[]
  onSelect: (value: T) => void
  width?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={triggerCls}>
        {label}
        <CaretDown />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute z-50 right-0 top-full mt-1 ${width} bg-[#1a1a2e] border border-[#3a3a5a] rounded-[10px] py-1 shadow-lg`}>
            {options.map((o) => (
              <button key={o.value} type="button" onClick={() => { onSelect(o.value); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 active:bg-[#2a2a4a] ${current === o.value ? 'text-[#6c63ff]' : 'text-white'}`}>
                <div className="text-[13px] font-semibold leading-tight">{o.label}</div>
                {o.sub && <div className="text-[10px] text-gray-500 leading-tight">{o.sub}</div>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Stepper({ value, min = 0, onChange, width = 'w-10' }: { value: number; min?: number; onChange: (v: number) => void; width?: string }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className={stepBtn}>−</button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value ? Math.max(min, Number(e.target.value)) : min)}
        onFocus={(e) => e.target.select()}
        className={`${width} ${boxBase}`}
        style={{ fontSize: 16 }}
      />
      <button type="button" onClick={() => onChange(value + 1)} className={stepBtn}>+</button>
    </div>
  )
}

function parseDuration(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  if (t.includes(':')) {
    const [m, s] = t.split(':')
    const mins = Number(m) || 0
    const secs = Number(s) || 0
    return mins * 60 + secs
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

type RepsMode = 'single' | 'range' | 'amrap'

function repsModeOf(s: EditableExercise['sets'][number] | undefined): RepsMode {
  if (s?.repsOpen) return 'amrap'
  if (s?.repsMax != null) return 'range'
  return 'single'
}

// ─── REPS column ────────────────────────────────────────────────────────────
function RepsControl({ ex, idx, act }: { ex: EditableExercise; idx: number; act: (a: Action) => void }) {
  const s0 = ex.sets[0]
  const mode = repsModeOf(s0)
  const reps = s0?.reps ?? null
  const repsMax = s0?.repsMax ?? null

  const selectMode = (next: RepsMode) => {
    if (next === mode) return
    const r = reps ?? 0
    if (next === 'single') act({ type: 'setReps', ex: idx, reps: r })
    else if (next === 'range') act({ type: 'setReps', ex: idx, reps: r, repsMax: r })
    else act({ type: 'setReps', ex: idx, reps: r, repsOpen: true })
  }

  const label = mode === 'single' ? 'Reps' : mode === 'range' ? 'Range' : 'AMRAP'

  // Range: single masked text input "m – n"
  const [rangeText, setRangeText] = useState(`${reps ?? ''} – ${repsMax ?? ''}`)
  useEffect(() => {
    if (mode === 'range') setRangeText(`${reps ?? ''} – ${repsMax ?? ''}`)
  }, [mode, reps, repsMax])

  const commitRange = (text: string) => {
    const nums = text.match(/\d+/g)
    const min = nums?.[0] != null ? Number(nums[0]) : null
    const max = nums?.[1] != null ? Number(nums[1]) : min
    act({ type: 'setReps', ex: idx, reps: min, repsMax: max })
  }

  // AMRAP: single box, min then "+"
  const amrapDisplay = reps != null ? `${reps}+` : 'AMRAP'

  let control: React.ReactNode
  if (mode === 'single') {
    control = <Stepper value={reps ?? 0} min={0} onChange={(v) => act({ type: 'setReps', ex: idx, reps: v })} />
  } else if (mode === 'range') {
    control = (
      <input
        type="text"
        inputMode="numeric"
        value={rangeText}
        onChange={(e) => { setRangeText(e.target.value); commitRange(e.target.value) }}
        onFocus={(e) => e.target.select()}
        className={`w-[72px] ${boxBase}`}
        style={{ fontSize: 16 }}
        placeholder="8 – 12"
      />
    )
  } else {
    control = (
      <input
        type="text"
        inputMode="numeric"
        value={amrapDisplay}
        onChange={(e) => {
          const n = e.target.value.match(/\d+/)
          act({ type: 'setReps', ex: idx, reps: n ? Number(n[0]) : null, repsOpen: true })
        }}
        onFocus={(e) => e.target.select()}
        className={`w-[72px] ${boxBase}`}
        style={{ fontSize: 16 }}
        placeholder="AMRAP"
      />
    )
  }

  return (
    <div>
      <Dropdown<RepsMode>
        label={label}
        current={mode}
        width="w-36"
        onSelect={selectMode}
        options={[
          { value: 'single', label: 'Single', sub: 'one rep target' },
          { value: 'range', label: 'Range', sub: 'min–max' },
          { value: 'amrap', label: 'AMRAP', sub: 'open / max reps' },
        ]}
      />
      <div className="flex items-center justify-center">{control}</div>
    </div>
  )
}

// ─── LOAD column ────────────────────────────────────────────────────────────
type LoadType = 'weight' | 'pct' | 'rpe' | 'rir' | 'bodyweight' | 'time' | 'distance'

const LOAD_MENU: { type: LoadType; label: string; sub: string }[] = [
  { type: 'weight', label: 'Weight', sub: 'lb / kg' },
  { type: 'pct', label: '% of 1RM/TM', sub: 'percent of 1RM or training max' },
  { type: 'rpe', label: 'RPE', sub: 'rate of perceived exertion' },
  { type: 'rir', label: 'RIR', sub: 'reps in reserve' },
  { type: 'bodyweight', label: 'Bodyweight', sub: 'no load' },
  { type: 'time', label: 'Time', sub: 'm:ss' },
  { type: 'distance', label: 'Distance', sub: 'm / km / mi' },
]

function loadTypeOf(ex: EditableExercise): LoadType {
  const measure = measureOf(ex.unit)
  if (measure === 'time') return 'time'
  if (measure === 'distance') return 'distance'
  if (measure !== 'weight') return 'bodyweight'
  if (ex.loadMode === 'pct') return 'pct'
  if (ex.loadMode === 'rpe') return 'rpe'
  if (ex.loadMode === 'rir') return 'rir'
  return 'weight'
}

function loadHeaderLabel(ex: EditableExercise, weightUnit: string): string {
  const t = loadTypeOf(ex)
  switch (t) {
    case 'weight': return (ex.unit || weightUnit).toUpperCase()
    case 'pct': return '%'
    case 'rpe': return 'RPE'
    case 'rir': return 'RIR'
    case 'time': return 'TIME'
    case 'distance': return 'DIST'
    case 'bodyweight': return '—'
  }
}

function LoadControl({ ex, idx, act, weightUnit, oneRepMax }: { ex: EditableExercise; idx: number; act: (a: Action) => void; weightUnit: string; oneRepMax?: number | null }) {
  const type = loadTypeOf(ex)
  const s0 = ex.sets[0]
  const value = s0?.value ?? null
  const pct = s0?.pct ?? null
  const rpe = s0?.rpe ?? null
  const rir = s0?.rir ?? null
  const reps = s0?.reps ?? 1

  const [durText, setDurText] = useState(value != null ? formatDuration(value) : '')
  useEffect(() => { if (type === 'time') setDurText(value != null ? formatDuration(value) : '') }, [type, value])

  const select = (t: LoadType) => {
    const unit = (t === 'weight' || t === 'pct' || t === 'rpe' || t === 'rir') ? weightUnit : undefined
    act({ type: 'setLoadType', ex: idx, loadType: t, unit })
  }

  // ≈ weight hint
  let hint: string | null = null
  if (oneRepMax != null) {
    if (type === 'pct' && pct != null) hint = `≈ ${Math.round(pct * oneRepMax / 100 / 5) * 5} ${ex.unit || weightUnit}`
    else if (type === 'rpe' && rpe != null) hint = `≈ ${Math.round(rpeToPct(reps, rpe) * oneRepMax / 5) * 5} ${ex.unit || weightUnit}`
    else if (type === 'rir' && rir != null) hint = `≈ ${Math.round(rirToPct(reps, rir) * oneRepMax / 5) * 5} ${ex.unit || weightUnit}`
  }

  let valueBox: React.ReactNode
  if (type === 'bodyweight') {
    valueBox = <span className="text-base text-gray-500">—</span>
  } else if (type === 'weight') {
    valueBox = (
      <input type="text" inputMode="decimal" value={value != null ? Math.round(value) : ''}
        onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()} className={`w-14 ${boxBase}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'pct') {
    valueBox = (
      <input type="text" inputMode="numeric" value={pct ?? ''}
        onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()} className={`w-12 ${boxBase}`} style={{ fontSize: 16 }} placeholder="%" />
    )
  } else if (type === 'rpe') {
    valueBox = (
      <input type="text" inputMode="decimal" value={rpe ?? ''}
        onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()} className={`w-12 ${boxBase}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'rir') {
    valueBox = (
      <input type="text" inputMode="numeric" value={rir ?? ''}
        onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()} className={`w-12 ${boxBase}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'time') {
    valueBox = (
      <input type="text" inputMode="numeric" value={durText}
        onChange={(e) => setDurText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => act({ type: 'setLoadValue', ex: idx, value: parseDuration(durText) })}
        className={`w-16 ${boxBase}`} style={{ fontSize: 16 }} placeholder="m:ss" />
    )
  } else {
    // distance
    valueBox = (
      <div className="flex items-center gap-1">
        <input type="text" inputMode="decimal" value={value != null ? value : ''}
          onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: e.target.value ? Number(e.target.value) : null })}
          onFocus={(e) => e.target.select()} className={`w-12 ${boxBase}`} style={{ fontSize: 16 }} placeholder="—" />
        <Dropdown<string>
          label={ex.unit || MEASURES.distance.units[0]}
          current={ex.unit || MEASURES.distance.units[0]}
          width="w-20"
          onSelect={(u) => act({ type: 'setUnit', ex: idx, unit: u })}
          options={MEASURES.distance.units.map((u) => ({ value: u, label: u }))}
        />
      </div>
    )
  }

  return (
    <div className="relative">
      <Dropdown<LoadType>
        label={loadHeaderLabel(ex, weightUnit)}
        current={type}
        onSelect={select}
        options={LOAD_MENU.map((m) => ({ value: m.type, label: m.label, sub: m.sub }))}
      />
      <div className="flex flex-col items-center justify-center">
        <div className="flex items-center justify-center h-9">{valueBox}</div>
        {hint && <span className="text-[10px] text-gray-500 leading-none">{hint}</span>}
      </div>
    </div>
  )
}

interface EditControlsProps {
  ex: EditableExercise
  idx: number
  act: (a: Action) => void
  weightUnit: string
  oneRepMax?: number | null
}

function ExerciseEditControls({ ex, idx, act, weightUnit, oneRepMax }: EditControlsProps) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 items-start">
      <div>
        <div className={headerCls}>Sets</div>
        <Stepper value={ex.sets.length} min={1} onChange={(v) => act({ type: 'setSetCount', ex: idx, count: v })} />
      </div>
      <RepsControl ex={ex} idx={idx} act={act} />
      <LoadControl ex={ex} idx={idx} act={act} weightUnit={weightUnit} oneRepMax={oneRepMax} />
    </div>
  )
}

// ─── Per-set editor (expanded) ───────────────────────────────────────────────
const setBox = 'bg-[#1a1a2e] rounded text-center font-semibold py-1 outline-none [appearance:textfield] focus:ring-1 focus:ring-[#6c63ff]'

function PerSetValueBox({ ex, idx, setIdx, type, act, weightUnit, oneRepMax }: {
  ex: EditableExercise; idx: number; setIdx: number; type: LoadType
  act: (a: Action) => void; weightUnit: string; oneRepMax?: number | null
}) {
  const s = ex.sets[setIdx]
  const value = s?.value ?? null
  const pct = s?.pct ?? null
  const rpe = s?.rpe ?? null
  const rir = s?.rir ?? null
  const reps = s?.reps ?? 1

  const [durText, setDurText] = useState(value != null ? formatDuration(value) : '')
  useEffect(() => { if (type === 'time') setDurText(value != null ? formatDuration(value) : '') }, [type, value])

  let hint: string | null = null
  if (oneRepMax != null) {
    if (type === 'pct' && pct != null) hint = `≈ ${Math.round(pct * oneRepMax / 100 / 5) * 5}`
    else if (type === 'rpe' && rpe != null) hint = `≈ ${Math.round(rpeToPct(reps, rpe) * oneRepMax / 5) * 5}`
    else if (type === 'rir' && rir != null) hint = `≈ ${Math.round(rirToPct(reps, rir) * oneRepMax / 5) * 5}`
  }

  let box: React.ReactNode
  if (type === 'weight') {
    box = (
      <input type="text" inputMode="decimal" value={value != null ? Math.round(value) : ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, value: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()} className={`w-16 ${setBox}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'pct') {
    box = (
      <input type="text" inputMode="numeric" value={pct ?? ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, pct: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()} className={`w-14 ${setBox}`} style={{ fontSize: 16 }} placeholder="%" />
    )
  } else if (type === 'rpe') {
    box = (
      <input type="text" inputMode="decimal" value={rpe ?? ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, rpe: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()} className={`w-14 ${setBox}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'rir') {
    box = (
      <input type="text" inputMode="numeric" value={rir ?? ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, rir: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()} className={`w-14 ${setBox}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'time') {
    box = (
      <input type="text" inputMode="numeric" value={durText}
        onChange={(e) => setDurText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => act({ type: 'setPerSet', ex: idx, set: setIdx, value: parseDuration(durText) })}
        className={`w-16 ${setBox}`} style={{ fontSize: 16 }} placeholder="m:ss" />
    )
  } else {
    // distance
    box = (
      <input type="text" inputMode="decimal" value={value != null ? value : ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, value: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()} className={`w-16 ${setBox}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  }

  void weightUnit
  return (
    <div className="flex flex-col items-center">
      {box}
      {hint && <span className="text-[10px] text-gray-500 leading-none mt-0.5">{hint}</span>}
    </div>
  )
}

function PerSetEditor({ ex, idx, act, weightUnit, oneRepMax }: {
  ex: EditableExercise; idx: number; act: (a: Action) => void; weightUnit: string; oneRepMax?: number | null
}) {
  const type = loadTypeOf(ex)
  const hasValueCol = type !== 'bodyweight'
  const valueLabel = loadHeaderLabel(ex, weightUnit)

  return (
    <div>
      <div className="flex items-center pb-1 text-[10px] uppercase tracking-wider text-gray-600">
        <div className="w-7">Set</div>
        <div className="flex-1 text-center">Reps</div>
        {hasValueCol && <div className="flex-1 text-center">{valueLabel}</div>}
        <div className="w-5" />
      </div>
      {ex.sets.map((s, setIdx) => (
        <SwipeableRow
          key={setIdx}
          actions={[{ label: 'Delete', icon: <SetTrashIcon />, color: '#c0392b', onClick: () => act({ type: 'removeSet', ex: idx, set: setIdx }) }]}
        >
          <div className={`flex items-center py-1.5 bg-[#2a2a4a] ${setIdx < ex.sets.length - 1 ? 'border-b border-[#3a3a5a]' : ''}`}>
            <div className="w-7 text-xs text-gray-500">{setIdx + 1}</div>
            <div className="flex-1 flex items-center justify-center">
              <input type="text" inputMode="numeric" value={s.reps ?? ''}
                onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, reps: e.target.value ? Number(e.target.value) : null })}
                onFocus={(e) => e.target.select()} className={`w-14 ${setBox}`} style={{ fontSize: 16 }} placeholder="—" />
            </div>
            {hasValueCol && (
              <div className="flex-1 flex items-center justify-center">
                <PerSetValueBox ex={ex} idx={idx} setIdx={setIdx} type={type} act={act} weightUnit={weightUnit} oneRepMax={oneRepMax} />
              </div>
            )}
            <div className="w-5" />
          </div>
        </SwipeableRow>
      ))}
      <button
        type="button"
        onClick={() => act({ type: 'addSet', ex: idx })}
        className="w-full mt-2 rounded-[10px] border border-dashed border-[#3a3a5a] bg-transparent flex items-center justify-center py-2 text-[#6c63ff] text-[13px] font-semibold active:opacity-80"
      >
        + Add set
      </button>
    </div>
  )
}

interface ExerciseRowProps {
  ex: EditableExercise
  idx: number
  focusIdx: number | null
  onFocused: () => void
  onRename: (name: string) => void
  act: (a: Action) => void
  knownExercises: string[]
  weightUnit: string
  oneRepMax?: number | null
}

function ExerciseRow({ ex, idx, focusIdx, onFocused, onRename, act, knownExercises, weightUnit, oneRepMax }: ExerciseRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (focusIdx === idx && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
      onFocused()
    }
  }, [focusIdx, idx, onFocused])

  const isDefault = ex.exercise === '' || ex.exercise === 'New exercise'

  const chips = useMemo(() => {
    const lowerInput = ex.exercise.toLowerCase()
    return knownExercises.filter((name) => {
      const lowerName = name.toLowerCase()
      if (!isDefault && !lowerName.includes(lowerInput)) return false
      return true
    }).slice(0, 24)
  }, [knownExercises, ex.exercise, isDefault])

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3 mb-2 border border-[#3a3a5a]">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-shrink-0 flex items-center justify-center w-4 active:opacity-70"
            aria-label={expanded ? 'Collapse exercise' : 'Expand exercise'}
          >
            {expanded ? <RowChevronDown /> : <RowChevronRight />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={ex.exercise}
            onChange={(e) => onRename(e.target.value)}
            onFocus={(e) => { e.target.select(); setInputFocused(true) }}
            onBlur={() => setInputFocused(false)}
            className={`flex-1 min-w-0 bg-transparent font-semibold text-white outline-none border-b border-transparent transition-colors truncate ${ex.exercise.trim() === '' ? 'ring-1 ring-red-500' : 'focus:border-[#6c63ff]'}`}
            style={{ fontSize: 16 }}
          />
        </div>
        {inputFocused && chips.length > 0 && (
          <div
            className="flex flex-wrap gap-2 mt-2"
            style={{ maxHeight: 84, overflowY: 'auto' }}
          >
            {chips.map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onRename(name)
                  setInputFocused(false)
                  inputRef.current?.blur()
                }}
                className="bg-[#3a3a5a] rounded-full px-2.5 py-1 text-xs text-white active:bg-[#6c63ff] active:opacity-80"
              >
                {name}
              </button>
            ))}
          </div>
        )}
        <ExerciseEditControls ex={ex} idx={idx} act={act} weightUnit={weightUnit} oneRepMax={oneRepMax} />
        {expanded && (
          <div className="mt-3 pt-3 border-t border-[#3a3a5a]">
            <PerSetEditor ex={ex} idx={idx} act={act} weightUnit={weightUnit} oneRepMax={oneRepMax} />
          </div>
        )}
      </div>
    </div>
  )
}

interface ExpandableRoutineCardProps {
  routine: { name: string; exercises: string[]; rows: RoutineRow[] }
  spreadsheetId: string
  allRows: RoutineRow[]
  loggedExercises: string[]
  mutateCache: (rows: RoutineRow[]) => void
  onStartWorkout: (rows: RoutineRow[]) => void
  initialExpanded?: boolean
  tourId?: string
  weightUnit: string
}

export function ExpandableRoutineCard({
  routine,
  spreadsheetId,
  allRows,
  loggedExercises,
  mutateCache,
  onStartWorkout,
  initialExpanded = false,
  tourId,
  weightUnit,
}: ExpandableRoutineCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)

  const allRowsRef = useRef(allRows)
  allRowsRef.current = allRows

  const mutateCacheRef = useRef(mutateCache)
  mutateCacheRef.current = mutateCache

  const stableOnSaved = useCallback((savedRows: RoutineRow[]) => {
    const updated = [
      ...allRowsRef.current.filter(
        (r) => !(r.program === savedRows[0]?.program && r.routine === savedRows[0]?.routine)
      ),
      ...savedRows,
    ]
    mutateCacheRef.current(updated)
  }, [])

  const initial = toEditable(routine.rows)
  const { state, status, act } = useRoutineEditor(spreadsheetId, initial, stableOnSaved)

  const chipSource = useMemo(
    () => buildChipSource(allRows, loggedExercises, state.program, state.routine, state.exercises),
    [allRows, loggedExercises, state.program, state.routine, state.exercises]
  )

  const statusText =
    status === 'saving' ? 'Saving…' :
    status === 'saved' ? 'Saved' :
    status === 'error' ? "Could not save - retry" :
    ''

  const statusColor =
    status === 'error' ? 'text-red-400' :
    status === 'saving' ? 'text-gray-400' :
    'text-[#6c63ff]'

  const defaultUnit = state.exercises.length > 0 ? state.exercises[0].unit : weightUnit

  const summaryLine = buildSummaryLine(state.exercises)

  return (
    <div
      data-tour={tourId}
      className="bg-[#2a2a4a] rounded-[10px] mb-2 overflow-hidden border border-transparent"
    >
      <div className="flex items-center gap-2 p-3.5">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center active:opacity-80"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </button>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left active:opacity-80"
        >
          {expanded ? (
            <input
              type="text"
              value={state.routine}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => act({ type: 'setRoutine', name: e.target.value })}
              onFocus={(e) => e.target.select()}
              className="w-full bg-transparent font-semibold text-white outline-none border-b border-transparent focus:border-[#6c63ff] transition-colors"
              style={{ fontSize: 15 }}
              placeholder="Routine name"
            />
          ) : (
            <div className="font-semibold text-[15px] truncate">{state.routine}</div>
          )}
          {!expanded && (
            <div className="text-[12px] text-gray-500 mt-0.5 truncate">{summaryLine || 'No exercises'}</div>
          )}
          {expanded && (
            <div className={`text-[11px] mt-0.5 ${statusColor}`}>{statusText}</div>
          )}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onStartWorkout(routine.rows) }}
          className="flex-shrink-0 bg-[#6c63ff] rounded-full px-3 py-1 text-[12px] font-semibold active:opacity-80"
        >
          Start
        </button>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-[#3a3a5a]">
          <div className="pt-3">
            {state.exercises.map((ex, i) => (
              <ExerciseRow
                key={i}
                ex={ex}
                idx={i}
                focusIdx={focusIdx}
                onFocused={() => setFocusIdx(null)}
                onRename={(name) => act({ type: 'renameExercise', ex: i, name })}
                act={act}
                knownExercises={chipSource}
                weightUnit={weightUnit}
              />
            ))}

            {/* TODO Task 10 — replace with AddExercisePicker */}
            <button
              onClick={() => {
                act({ type: 'addExercise', name: 'New exercise', unit: defaultUnit })
                setFocusIdx(state.exercises.length)
              }}
              className="w-full mt-2 rounded-[10px] border border-dashed border-[#3a3a5a] bg-transparent flex items-center justify-center py-3 text-[#6c63ff] text-sm font-semibold active:opacity-80"
            >
              + Add exercise
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface DraftRoutineCardProps {
  program: string
  spreadsheetId: string
  allRows: RoutineRow[]
  loggedExercises: string[]
  mutateCache: (rows: RoutineRow[]) => void
  onSavedToList: () => void
  onNameChange: (name: string) => void
  weightUnit: string
}

export function DraftRoutineCard({
  program,
  spreadsheetId,
  allRows,
  loggedExercises,
  mutateCache,
  onSavedToList: _onSavedToList,
  onNameChange,
  weightUnit,
}: DraftRoutineCardProps) {
  const [focusIdx, setFocusIdx] = useState<number | null>(null)

  const allRowsRef = useRef(allRows)
  allRowsRef.current = allRows

  const mutateCacheRef = useRef(mutateCache)
  mutateCacheRef.current = mutateCache

  const stableOnSaved = useCallback((savedRows: RoutineRow[]) => {
    const updated = [
      ...allRowsRef.current.filter(
        (r) => !(r.program === savedRows[0]?.program && r.routine === savedRows[0]?.routine)
      ),
      ...savedRows,
    ]
    mutateCacheRef.current(updated)
  }, [])

  const initial: EditableRoutine = { program, routine: 'New Routine', exercises: [] }
  const { state, status, act } = useRoutineEditor(spreadsheetId, initial, stableOnSaved)

  const chipSource = useMemo(
    () => buildChipSource(allRows, loggedExercises, state.program, state.routine, state.exercises),
    [allRows, loggedExercises, state.program, state.routine, state.exercises]
  )

  const statusText =
    status === 'saving' ? 'Saving…' :
    status === 'saved' ? 'Saved' :
    status === 'error' ? "Could not save - retry" :
    ''

  const statusColor =
    status === 'error' ? 'text-red-400' :
    status === 'saving' ? 'text-gray-400' :
    'text-[#6c63ff]'

  const defaultUnit = state.exercises.length > 0 ? state.exercises[0].unit : weightUnit

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] mb-2 overflow-hidden border border-[#6c63ff]/40">
      <div className="flex items-center gap-2 p-3.5">
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          <ChevronDown />
        </div>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={state.routine}
            onChange={(e) => { act({ type: 'setRoutine', name: e.target.value }); onNameChange(e.target.value) }}
            onFocus={(e) => e.target.select()}
            className="w-full bg-transparent font-semibold text-white outline-none border-b border-transparent focus:border-[#6c63ff] transition-colors"
            style={{ fontSize: 15 }}
            placeholder="Routine name"
            autoFocus
          />
          <div className={`text-[11px] mt-0.5 ${statusColor}`}>{statusText}</div>
        </div>
      </div>

      <div className="px-3.5 pb-3.5 border-t border-[#3a3a5a]">
        <div className="pt-3">
          {state.exercises.map((ex, i) => (
            <ExerciseRow
              key={i}
              ex={ex}
              idx={i}
              focusIdx={focusIdx}
              onFocused={() => setFocusIdx(null)}
              onRename={(name) => act({ type: 'renameExercise', ex: i, name })}
              act={act}
              knownExercises={chipSource}
              weightUnit={weightUnit}
            />
          ))}

          {/* TODO Task 10 — replace with AddExercisePicker */}
          <button
            onClick={() => {
              act({ type: 'addExercise', name: 'New exercise', unit: defaultUnit })
              setFocusIdx(state.exercises.length)
            }}
            className="w-full mt-2 rounded-[10px] border border-dashed border-[#3a3a5a] bg-transparent flex items-center justify-center py-3 text-[#6c63ff] text-sm font-semibold active:opacity-80"
          >
            + Add exercise
          </button>
        </div>
      </div>
    </div>
  )
}
