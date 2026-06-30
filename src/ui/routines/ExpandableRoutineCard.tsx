import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRoutineEditor } from '../../data/useRoutineEditor'
import { toEditable } from '../../data/routineModel'
import { formatValue, formatDuration, measureOf, MEASURES, type Measure } from '../../data/measure'
import type { Action } from '../../data/routineEditorReducer'
import type { EditableRoutine, RoutineRow } from '../../types'

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


function buildScheme(ex: EditableRoutine['exercises'][number]): string {
  const setCount = ex.sets.length
  const reps = ex.sets[0]?.reps
  const value = ex.sets[0]?.value
  const parts: string[] = []
  if (reps != null) {
    parts.push(`${setCount}×${reps}`)
  } else {
    parts.push(`${setCount} sets`)
  }
  if (value != null) {
    const formatted = formatValue(value, ex.unit)
    if (formatted) parts.push(formatted)
  }
  return parts.join(' ')
}

function buildSummaryLine(exercises: EditableRoutine['exercises']): string {
  const MAX_CHARS = 72
  const parts = exercises.map((ex) => `${ex.exercise} ${buildScheme(ex)}`)
  const joined = parts.join(' · ')
  if (joined.length <= MAX_CHARS) return joined
  // Truncate gracefully — show as many full exercise entries as fit, then "…"
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
const numField = 'w-11 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] focus:ring-1 focus:ring-[#6c63ff]'

function Stepper({ value, min = 0, onChange }: { value: number; min?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className={stepBtn}>−</button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value ? Math.max(min, Number(e.target.value)) : min)}
        onFocus={(e) => e.target.select()}
        className={numField}
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

const MEASURE_ORDER: Measure[] = ['weight', 'reps', 'time', 'distance']

function MeasurePicker({ measure, onChange }: { measure: Measure; onChange: (m: Measure) => void }) {
  return (
    <div className="flex items-center gap-1">
      {MEASURE_ORDER.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-2 py-0.5 rounded-full text-[11px] border active:opacity-80 ${
            measure === m
              ? 'border-[#6c63ff] text-[#6c63ff] bg-[#6c63ff]/10'
              : 'border-[#3a3a5a] text-gray-500'
          }`}
        >
          {MEASURES[m].label}
        </button>
      ))}
    </div>
  )
}

function UnitToggle({ units, unit, onChange }: { units: readonly string[]; unit: string; onChange: (u: string) => void }) {
  return (
    <div className="flex items-center rounded bg-[#1a1a2e] overflow-hidden border border-[#3a3a5a]">
      {units.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`px-2 py-1 text-[12px] active:opacity-80 ${
            unit === u ? 'bg-[#6c63ff] text-white font-semibold' : 'text-gray-400'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  )
}

interface EditControlsProps {
  ex: EditableRoutine['exercises'][number]
  idx: number
  act: (a: Action) => void
  oneRepMax?: number | null
}

function ExerciseEditControls({ ex, idx, act, oneRepMax }: EditControlsProps) {
  const measure = measureOf(ex.unit)
  const setCount = ex.sets.length
  const reps = ex.sets[0]?.reps ?? 0
  const value = ex.sets[0]?.value ?? null
  const pct = ex.sets[0]?.pct ?? null
  const [durText, setDurText] = useState(value != null ? formatDuration(value) : '')

  useEffect(() => {
    setDurText(value != null ? formatDuration(value) : '')
  }, [value])

  const targetWeight = pct != null && oneRepMax != null
    ? Math.round(pct * oneRepMax / 100 / 5) * 5
    : null

  let valueLabel: string | null = null
  if (measure === 'weight') valueLabel = ex.loadMode === 'pct' ? '% 1RM' : 'Load'
  else if (measure === 'time') valueLabel = 'Time'
  else if (measure === 'distance') valueLabel = 'Distance'

  // The numeric value box for the LOAD column (compact, fits the third column).
  // Unit toggles (lb/kg, m/km/mi) and the %/lb mode toggle live on the second row below.
  let valueControl: React.ReactNode = null
  if (measure === 'weight') {
    valueControl = ex.loadMode === 'pct' ? (
      <input
        type="text"
        inputMode="numeric"
        value={pct ?? ''}
        onChange={(e) => act({ type: 'setUniformLoad', ex: idx, value: null, pct: e.target.value ? Number(e.target.value) : null })}
        onFocus={(e) => e.target.select()}
        className={numField}
        style={{ fontSize: 16 }}
        placeholder="%"
      />
    ) : (
      <input
        type="text"
        inputMode="decimal"
        value={value != null ? Math.round(value) : ''}
        onChange={(e) => act({ type: 'setUniformLoad', ex: idx, value: e.target.value ? Number(e.target.value) : null, pct: null })}
        onFocus={(e) => e.target.select()}
        className={numField}
        style={{ fontSize: 16 }}
        placeholder="—"
      />
    )
  } else if (measure === 'time') {
    valueControl = (
      <input
        type="text"
        inputMode="numeric"
        value={durText}
        onChange={(e) => setDurText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => act({ type: 'setUniformLoad', ex: idx, value: parseDuration(durText), pct: null })}
        className="w-16 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none focus:ring-1 focus:ring-[#6c63ff]"
        style={{ fontSize: 16 }}
        placeholder="m:ss"
      />
    )
  } else if (measure === 'distance') {
    valueControl = (
      <input
        type="text"
        inputMode="decimal"
        value={value != null ? value : ''}
        onChange={(e) => act({ type: 'setUniformLoad', ex: idx, value: e.target.value ? Number(e.target.value) : null, pct: null })}
        onFocus={(e) => e.target.select()}
        className={numField}
        style={{ fontSize: 16 }}
        placeholder="—"
      />
    )
  }

  const headerCls = 'text-[10px] text-gray-500 uppercase tracking-wider text-center'

  // Second-row toggles: %/lb mode for weight, m/km/mi unit for distance.
  let modeRow: React.ReactNode = null
  if (measure === 'weight') {
    modeRow = (
      <button
        type="button"
        onClick={() => act({ type: 'setLoadMode', ex: idx, mode: ex.loadMode === 'pct' ? 'lb' : 'pct' })}
        className={`px-2 py-1 rounded text-[12px] border active:opacity-80 ${
          ex.loadMode === 'pct' ? 'border-[#6c63ff] text-[#6c63ff]' : 'border-[#3a3a5a] text-gray-400'
        }`}
      >
        {ex.loadMode === 'pct' ? '%' : 'lb'}
      </button>
    )
  } else if (measure === 'distance') {
    modeRow = (
      <UnitToggle units={MEASURES.distance.units} unit={ex.unit} onChange={(u) => act({ type: 'setUnit', ex: idx, unit: u })} />
    )
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Core row — SETS / REPS / LOAD as compact columns on one line */}
      <div className={`grid ${valueControl ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
        <div>
          <div className={`${headerCls} pb-1`}>Sets</div>
          <Stepper value={setCount} min={1} onChange={(v) => act({ type: 'setSetCount', ex: idx, count: v })} />
        </div>
        <div>
          <div className={`${headerCls} pb-1`}>Reps</div>
          <Stepper value={reps} min={0} onChange={(v) => act({ type: 'setUniformReps', ex: idx, reps: v })} />
        </div>
        {valueControl && (
          <div>
            <div className={`${headerCls} pb-1`}>{valueLabel}</div>
            <div className="flex items-center justify-center">{valueControl}</div>
          </div>
        )}
      </div>

      {/* Second row — measure picker, %/lb or distance unit toggle, ≈ hint */}
      <div className="flex items-center flex-wrap gap-2">
        <MeasurePicker measure={measure} onChange={(m) => act({ type: 'setMeasure', ex: idx, measure: m })} />
        {modeRow}
        {measure === 'weight' && ex.loadMode === 'pct' && targetWeight != null && (
          <span className="text-[12px] text-gray-500">≈ {targetWeight} {ex.unit}</span>
        )}
        {/* TODO: lb/kg unit slicer */}
      </div>
    </div>
  )
}

interface ExerciseRowProps {
  ex: EditableRoutine['exercises'][number]
  idx: number
  focusIdx: number | null
  onFocused: () => void
  onRename: (name: string) => void
  act: (a: Action) => void
  knownExercises: string[]
}

function ExerciseRow({ ex, idx, focusIdx, onFocused, onRename, act, knownExercises }: ExerciseRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputFocused, setInputFocused] = useState(false)

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
      {/* TODO Task 8: swipe-to-delete via SwipeableRow */}
      <div className="min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={ex.exercise}
          onChange={(e) => onRename(e.target.value)}
          onFocus={(e) => { e.target.select(); setInputFocused(true) }}
          onBlur={() => setInputFocused(false)}
          className={`w-full bg-transparent font-semibold text-white outline-none border-b border-transparent transition-colors truncate ${ex.exercise.trim() === '' ? 'ring-1 ring-red-500' : 'focus:border-[#6c63ff]'}`}
          style={{ fontSize: 16 }}
        />
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
        <ExerciseEditControls ex={ex} idx={idx} act={act} />
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
}: ExpandableRoutineCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)

  // Keep onSaved stable — use a ref so allRows closure stays fresh without re-creating the callback
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

  const defaultUnit = state.exercises.length > 0 ? state.exercises[0].unit : 'lbs'

  const summaryLine = buildSummaryLine(state.exercises)

  return (
    <div
      data-tour={tourId}
      className="bg-[#2a2a4a] rounded-[10px] mb-2 overflow-hidden border border-transparent"
    >
      {/* Card header — always visible */}
      <div className="flex items-center gap-2 p-3.5">
        {/* Caret — expand/collapse affordance */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center active:opacity-80"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </button>

        {/* Title + summary (tapping toggles expand too) */}
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

        {/* Start pill — pinned top-right */}
        <button
          onClick={(e) => { e.stopPropagation(); onStartWorkout(routine.rows) }}
          className="flex-shrink-0 bg-[#6c63ff] rounded-full px-3 py-1 text-[12px] font-semibold active:opacity-80"
        >
          Start
        </button>
      </div>

      {/* Expanded body */}
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
}

export function DraftRoutineCard({
  program,
  spreadsheetId,
  allRows,
  loggedExercises,
  mutateCache,
  onSavedToList: _onSavedToList,
  onNameChange,
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

  const defaultUnit = state.exercises.length > 0 ? state.exercises[0].unit : 'lbs'

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
