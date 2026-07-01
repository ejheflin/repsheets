import { useState, useCallback, useRef, useEffect, useMemo, useId } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRoutineEditor } from '../../data/useRoutineEditor'
import { toEditable, toRows } from '../../data/routineModel'
import { formatValue, formatDuration, measureOf, MEASURES, roundWeight } from '../../data/measure'
import { rpeToPct, rirToPct } from '../../workout/rpe'
import { SwipeableRow } from '../shared/SwipeableRow'
import { useUndoToast, UndoToast } from '../shared/UndoToast'
import type { Action } from '../../data/routineEditorReducer'
import type { EditableRoutine, RoutineRow, EditableExercise } from '../../types'

export type GetMax = (name: string) => { e1rm: number | null; tm: number | null }

// Cross-routine drag: each card registers a live handle (keyed by a stable card id)
// so the single DndContext in RoutinesTab can move an exercise between two cards.
export interface CardRegistration {
  getExercises: () => EditableExercise[]
  act: (a: Action) => void
}
export type RegisterCard = (id: string, api: CardRegistration) => void
export type UnregisterCard = (id: string) => void

// Tracks whether keyboard focus currently lives inside a card. Focus moving
// between two inputs in the same card briefly fires blur→focus; a short timeout
// (cancelled by the incoming focus) keeps `editing` true across that gap so we
// don't flush+remount between every field. Only a true exit flips it to false.
function useCardEditing() {
  const [editing, setEditing] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(blurTimer.current), [])

  const onFocusCapture = useCallback(() => {
    clearTimeout(blurTimer.current)
    setEditing(true)
  }, [])

  const onBlurCapture = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    clearTimeout(blurTimer.current)
    blurTimer.current = setTimeout(() => {
      if (!card.contains(document.activeElement)) setEditing(false)
    }, 150)
  }, [])

  return { editing, onFocusCapture, onBlurCapture }
}

// Suggested working weight for autoregulation modes, rounded to the bar increment.
// Returns null when there's no e1rm basis to compute from.
function suggestedWeight(
  type: LoadType,
  ex: EditableExercise,
  reps: number,
  load: { value: number | null; pct: number | null; rpe: number | null; rir: number | null },
  max: { e1rm: number | null; tm: number | null },
  unit: string,
): number | null {
  const { e1rm, tm } = max
  if (e1rm == null) return null
  let raw: number | null = null
  if (type === 'pct' && load.pct != null) {
    raw = ex.basis === 'tm' ? (load.pct / 100) * e1rm * (tm ?? 0.9) : (load.pct / 100) * e1rm
  } else if (type === 'rpe' && load.rpe != null) {
    raw = rpeToPct(reps, load.rpe) * e1rm
  } else if (type === 'rir' && load.rir != null) {
    raw = rirToPct(reps, load.rir) * e1rm
  }
  if (raw == null) return null
  return roundWeight(raw, unit)
}

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

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  )
}

// Purple gutter bracket overlay spanning a contiguous superset run.
function SupersetBracket() {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: -7, top: 4, bottom: 12, width: 6, border: '1.5px solid #6c63ff', borderRight: 'none', borderRadius: '5px 0 0 5px' }}
    >
      <span
        className="absolute"
        style={{
          left: -8, top: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)', transformOrigin: 'center',
          fontSize: 7, fontWeight: 800, letterSpacing: '.5px', color: '#6c63ff', whiteSpace: 'nowrap',
        }}
      >
        SUPER
      </span>
    </div>
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

// Map Tailwind width tokens to pixel widths so right-alignment math works in the
// fixed-position portal (the portal escapes the card so % widths have no anchor).
const DROPDOWN_WIDTHS: Record<string, number> = {
  'w-20': 80,
  'w-36': 144,
  'w-40': 160,
  'w-44': 176,
}

// Shared small anchored dropdown: tap trigger → menu, closes on select / outside-tap.
// The menu renders in a portal at the document body with position:fixed so it
// escapes the card's overflow-hidden / transform ancestors and is never clipped.
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuWidth = DROPDOWN_WIDTHS[width] ?? 176

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.max(8, rect.right - menuWidth)
    setPos({ top: rect.bottom + 4, left })
  }, [menuWidth])

  const openMenu = () => { place(); setOpen(true) }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={triggerCls}
      >
        {label}
        <CaretDown />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-[#1a1a2e] border border-[#3a3a5a] rounded-[10px] py-1 shadow-lg"
            style={{ top: pos.top, left: pos.left, width: menuWidth }}
          >
            {options.map((o) => (
              <button key={o.value} type="button" onClick={() => { onSelect(o.value); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 active:bg-[#2a2a4a] ${current === o.value ? 'text-[#6c63ff]' : 'text-white'}`}>
                <div className="text-[13px] font-semibold leading-tight">{o.label}</div>
                {o.sub && <div className="text-[10px] text-gray-500 leading-tight">{o.sub}</div>}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

function Stepper({ value, min = 0, onChange, width = 'w-10', mismatch = false }: { value: number; min?: number; onChange: (v: number) => void; width?: string; mismatch?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className={stepBtn}>−</button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value ? Math.max(min, Number(e.target.value)) : min)}
        onFocus={(e) => e.target.select()}
        className={`${width} ${boxBase}${mismatch ? ` ${mismatchRing}` : ''}`}
        style={{ fontSize: 16 }}
      />
      <button type="button" onClick={() => onChange(value + 1)} className={stepBtn}>+</button>
    </div>
  )
}

// Sanitize a free-typed numeric field: keep digits and a single dot, parse to a
// finite number, otherwise null. Never yields NaN (so the controlled input can't
// get stuck showing NaN and stays clearable).
function sanitizeNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '')
  if (cleaned === '') return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
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
function RepsControl({ ex, idx, act, mismatch = false }: { ex: EditableExercise; idx: number; act: (a: Action) => void; mismatch?: boolean }) {
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
    control = <Stepper value={reps ?? 0} min={0} mismatch={mismatch} onChange={(v) => act({ type: 'setReps', ex: idx, reps: v })} />
  } else if (mode === 'range') {
    control = (
      <input
        type="text"
        inputMode="numeric"
        value={rangeText}
        onChange={(e) => { setRangeText(e.target.value); commitRange(e.target.value) }}
        onFocus={(e) => e.target.select()}
        className={`w-[72px] ${boxBase}${mismatch ? ` ${mismatchRing}` : ''}`}
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
        className={`w-[72px] ${boxBase}${mismatch ? ` ${mismatchRing}` : ''}`}
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

type LoadMenuValue = 'weight' | 'pct1rm' | 'pcttm' | 'rpe' | 'rir' | 'bodyweight' | 'time' | 'distance'

const LOAD_MENU: { value: LoadMenuValue; label: string; sub: string }[] = [
  { value: 'weight', label: 'Weight', sub: 'lb / kg' },
  { value: 'pct1rm', label: '% of 1RM', sub: 'percent of 1-rep max' },
  { value: 'pcttm', label: '% of Training Max', sub: 'percent of training max' },
  { value: 'rpe', label: 'RPE', sub: 'rate of perceived exertion' },
  { value: 'rir', label: 'RIR', sub: 'reps in reserve' },
  { value: 'bodyweight', label: 'Bodyweight', sub: 'no load' },
  { value: 'time', label: 'Time', sub: 'm:ss' },
  { value: 'distance', label: 'Distance', sub: 'm / km / mi' },
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

type LoadField = 'value' | 'pct' | 'rpe' | 'rir'

function loadFieldOf(type: LoadType): LoadField {
  if (type === 'pct') return 'pct'
  if (type === 'rpe') return 'rpe'
  if (type === 'rir') return 'rir'
  return 'value'
}

function repsMismatchOf(ex: EditableExercise): boolean {
  const s0 = ex.sets[0]?.reps ?? null
  return ex.sets.some((s) => (s.reps ?? null) !== s0)
}

function loadMismatchOf(ex: EditableExercise): boolean {
  const field = loadFieldOf(loadTypeOf(ex))
  const s0 = ex.sets[0]?.[field] ?? null
  return ex.sets.some((s) => (s[field] ?? null) !== s0)
}

const mismatchRing = 'ring-1 ring-red-500'

function loadHeaderLabel(ex: EditableExercise, weightUnit: string): string {
  const t = loadTypeOf(ex)
  switch (t) {
    case 'weight': return (ex.unit || weightUnit).toUpperCase()
    case 'pct': return ex.basis === 'tm' ? '% TM' : '% 1RM'
    case 'rpe': return 'RPE'
    case 'rir': return 'RIR'
    case 'time': return 'TIME'
    case 'distance': return 'DIST'
    case 'bodyweight': return '—'
  }
}

function LoadControl({ ex, idx, act, weightUnit, getMax, mismatch = false }: { ex: EditableExercise; idx: number; act: (a: Action) => void; weightUnit: string; getMax?: GetMax; mismatch?: boolean }) {
  const type = loadTypeOf(ex)
  const s0 = ex.sets[0]
  const value = s0?.value ?? null
  const pct = s0?.pct ?? null
  const rpe = s0?.rpe ?? null
  const rir = s0?.rir ?? null
  const reps = s0?.reps ?? 1

  const [durText, setDurText] = useState(value != null ? formatDuration(value) : '')
  useEffect(() => { if (type === 'time') setDurText(value != null ? formatDuration(value) : '') }, [type, value])

  const selectMenu = (v: LoadMenuValue) => {
    if (v === 'pct1rm' || v === 'pcttm') {
      act({ type: 'setLoadType', ex: idx, loadType: 'pct', unit: weightUnit })
      act({ type: 'setBasis', ex: idx, basis: v === 'pcttm' ? 'tm' : '1rm' })
      return
    }
    const unit = (v === 'weight' || v === 'rpe' || v === 'rir') ? weightUnit : undefined
    act({ type: 'setLoadType', ex: idx, loadType: v, unit })
  }

  const currentMenu: LoadMenuValue = type === 'pct' ? (ex.basis === 'tm' ? 'pcttm' : 'pct1rm') : type

  // ≈ weight hint
  const hintUnit = ex.unit || weightUnit
  const suggested = getMax
    ? suggestedWeight(type, ex, reps, { value, pct, rpe, rir }, getMax(ex.exercise), hintUnit)
    : null
  const hint = suggested != null ? `≈ ${suggested} ${hintUnit}` : null

  const ring = mismatch ? ` ${mismatchRing}` : ''

  let valueBox: React.ReactNode
  if (type === 'bodyweight') {
    valueBox = <span className="text-base text-gray-500">—</span>
  } else if (type === 'weight') {
    valueBox = (
      <input type="text" inputMode="decimal" value={value != null ? Math.round(value) : ''}
        onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: sanitizeNumber(e.target.value) })}
        onFocus={(e) => e.target.select()} className={`w-14 ${boxBase}${ring}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'pct') {
    valueBox = (
      <input type="text" inputMode="numeric" value={pct ?? ''}
        onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: sanitizeNumber(e.target.value) })}
        onFocus={(e) => e.target.select()} className={`w-12 ${boxBase}${ring}`} style={{ fontSize: 16 }} placeholder="%" />
    )
  } else if (type === 'rpe') {
    valueBox = (
      <input type="text" inputMode="decimal" value={rpe ?? ''}
        onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: sanitizeNumber(e.target.value) })}
        onFocus={(e) => e.target.select()} className={`w-12 ${boxBase}${ring}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'rir') {
    valueBox = (
      <input type="text" inputMode="numeric" value={rir ?? ''}
        onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: sanitizeNumber(e.target.value) })}
        onFocus={(e) => e.target.select()} className={`w-12 ${boxBase}${ring}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'time') {
    valueBox = (
      <input type="text" inputMode="numeric" value={durText}
        onChange={(e) => setDurText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => act({ type: 'setLoadValue', ex: idx, value: parseDuration(durText) })}
        className={`w-16 ${boxBase}${ring}`} style={{ fontSize: 16 }} placeholder="m:ss" />
    )
  } else {
    // distance
    valueBox = (
      <div className="flex items-center gap-1">
        <input type="text" inputMode="decimal" value={value != null ? value : ''}
          onChange={(e) => act({ type: 'setLoadValue', ex: idx, value: sanitizeNumber(e.target.value) })}
          onFocus={(e) => e.target.select()} className={`w-12 ${boxBase}${ring}`} style={{ fontSize: 16 }} placeholder="—" />
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
      <Dropdown<LoadMenuValue>
        label={loadHeaderLabel(ex, weightUnit)}
        current={currentMenu}
        onSelect={selectMenu}
        options={LOAD_MENU}
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
  getMax?: GetMax
}

function ExerciseEditControls({ ex, idx, act, weightUnit, getMax }: EditControlsProps) {
  const repsMismatch = repsMismatchOf(ex)
  const loadMismatch = loadMismatchOf(ex)
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 items-start">
      <div>
        <div className={headerCls}>Sets</div>
        <Stepper value={ex.sets.length} min={1} onChange={(v) => act({ type: 'setSetCount', ex: idx, count: v })} />
      </div>
      <RepsControl ex={ex} idx={idx} act={act} mismatch={repsMismatch} />
      <LoadControl ex={ex} idx={idx} act={act} weightUnit={weightUnit} getMax={getMax} mismatch={loadMismatch} />
    </div>
  )
}

// ─── Per-set editor (expanded) ───────────────────────────────────────────────
const setBox = 'bg-[#1a1a2e] rounded text-center font-semibold py-1 outline-none [appearance:textfield] focus:ring-1 focus:ring-[#6c63ff]'

function PerSetValueBox({ ex, idx, setIdx, type, act, weightUnit, getMax, mismatch = false }: {
  ex: EditableExercise; idx: number; setIdx: number; type: LoadType
  act: (a: Action) => void; weightUnit: string; getMax?: GetMax; mismatch?: boolean
}) {
  const s = ex.sets[setIdx]
  const value = s?.value ?? null
  const pct = s?.pct ?? null
  const rpe = s?.rpe ?? null
  const rir = s?.rir ?? null
  const reps = s?.reps ?? 1

  const [durText, setDurText] = useState(value != null ? formatDuration(value) : '')
  useEffect(() => { if (type === 'time') setDurText(value != null ? formatDuration(value) : '') }, [type, value])

  const suggested = getMax
    ? suggestedWeight(type, ex, reps, { value, pct, rpe, rir }, getMax(ex.exercise), ex.unit || weightUnit)
    : null
  const hint = suggested != null ? `≈ ${suggested}` : null

  const ring = mismatch ? ` ${mismatchRing}` : ''

  let box: React.ReactNode
  if (type === 'weight') {
    box = (
      <input type="text" inputMode="decimal" value={value != null ? Math.round(value) : ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, value: sanitizeNumber(e.target.value) })}
        onFocus={(e) => e.target.select()} className={`w-16 ${setBox}${ring}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'pct') {
    box = (
      <input type="text" inputMode="numeric" value={pct ?? ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, pct: sanitizeNumber(e.target.value) })}
        onFocus={(e) => e.target.select()} className={`w-14 ${setBox}${ring}`} style={{ fontSize: 16 }} placeholder="%" />
    )
  } else if (type === 'rpe') {
    box = (
      <input type="text" inputMode="decimal" value={rpe ?? ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, rpe: sanitizeNumber(e.target.value) })}
        onFocus={(e) => e.target.select()} className={`w-14 ${setBox}${ring}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'rir') {
    box = (
      <input type="text" inputMode="numeric" value={rir ?? ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, rir: sanitizeNumber(e.target.value) })}
        onFocus={(e) => e.target.select()} className={`w-14 ${setBox}${ring}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  } else if (type === 'time') {
    box = (
      <input type="text" inputMode="numeric" value={durText}
        onChange={(e) => setDurText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => act({ type: 'setPerSet', ex: idx, set: setIdx, value: parseDuration(durText) })}
        className={`w-16 ${setBox}${ring}`} style={{ fontSize: 16 }} placeholder="m:ss" />
    )
  } else {
    // distance
    box = (
      <input type="text" inputMode="decimal" value={value != null ? value : ''}
        onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, value: sanitizeNumber(e.target.value) })}
        onFocus={(e) => e.target.select()} className={`w-16 ${setBox}${ring}`} style={{ fontSize: 16 }} placeholder="—" />
    )
  }

  return (
    <div className="flex flex-col items-center">
      {box}
      {hint && <span className="text-[10px] text-gray-500 leading-none mt-0.5">{hint}</span>}
    </div>
  )
}

function PerSetEditor({ ex, idx, act, weightUnit, getMax, hasNext }: {
  ex: EditableExercise; idx: number; act: (a: Action) => void; weightUnit: string; getMax?: GetMax; hasNext: boolean
}) {
  const type = loadTypeOf(ex)
  const hasValueCol = type !== 'bodyweight'
  const valueLabel = loadHeaderLabel(ex, weightUnit)
  const loadField = loadFieldOf(type)
  const summaryReps = ex.sets[0]?.reps ?? null
  const summaryLoad = ex.sets[0]?.[loadField] ?? null

  return (
    <div>
      <div className="flex items-center pb-1 text-[10px] uppercase tracking-wider text-gray-600">
        <div className="w-7">Set</div>
        <div className="flex-1 text-center">Reps</div>
        {hasValueCol && <div className="flex-1 text-center">{valueLabel}</div>}
        <div className="w-5" />
      </div>
      {ex.sets.map((s, setIdx) => {
        const repsFlag = (s.reps ?? null) !== summaryReps
        const loadFlag = (s[loadField] ?? null) !== summaryLoad
        return (
        <SwipeableRow
          key={setIdx}
          actions={[{ label: 'Delete', icon: <SetTrashIcon />, color: '#c0392b', onClick: () => act({ type: 'removeSet', ex: idx, set: setIdx }) }]}
        >
          <div className={`flex items-center py-1.5 bg-[#2a2a4a] ${setIdx < ex.sets.length - 1 ? 'border-b border-[#3a3a5a]' : ''}`}>
            <div className="w-7 text-xs text-gray-500">{setIdx + 1}</div>
            <div className="flex-1 flex items-center justify-center">
              <input type="text" inputMode="numeric" value={s.reps ?? ''}
                onChange={(e) => act({ type: 'setPerSet', ex: idx, set: setIdx, reps: e.target.value ? Number(e.target.value) : null })}
                onFocus={(e) => e.target.select()} className={`w-14 ${setBox}${repsFlag ? ` ${mismatchRing}` : ''}`} style={{ fontSize: 16 }} placeholder="—" />
            </div>
            {hasValueCol && (
              <div className="flex-1 flex items-center justify-center">
                <PerSetValueBox ex={ex} idx={idx} setIdx={setIdx} type={type} act={act} weightUnit={weightUnit} getMax={getMax} mismatch={loadFlag} />
              </div>
            )}
            <div className="w-5" />
          </div>
        </SwipeableRow>
        )
      })}
      <button
        type="button"
        onClick={() => act({ type: 'addSet', ex: idx })}
        className="w-full mt-2 rounded-[10px] border border-dashed border-[#3a3a5a] bg-transparent flex items-center justify-center py-2 text-[#6c63ff] text-[13px] font-semibold active:opacity-80"
      >
        + Add set
      </button>
      {ex.supersetGroup != null ? (
        <button
          type="button"
          onClick={() => act({ type: 'ungroup', ex: idx })}
          className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-[#6c63ff] text-[12px] font-semibold active:opacity-80"
        >
          <LinkIcon />
          Ungroup
        </button>
      ) : hasNext ? (
        <button
          type="button"
          onClick={() => act({ type: 'groupWithNext', ex: idx })}
          className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-[#6c63ff] text-[12px] font-semibold active:opacity-80"
        >
          <LinkIcon />
          Group with next as superset
        </button>
      ) : null}
    </div>
  )
}

interface ExerciseRowProps {
  ex: EditableExercise
  idx: number
  focusIdx: number | null
  onFocused: () => void
  onRename: (name: string) => void
  onDelete: () => void
  act: (a: Action) => void
  knownExercises: string[]
  weightUnit: string
  getMax?: GetMax
  hasNext: boolean
  dragListeners?: SyntheticListenerMap
  dragAttributes?: DraggableAttributes
  isDragging?: boolean
}

function ExerciseRow({ ex, idx, focusIdx, onFocused, onRename, onDelete, act, knownExercises, weightUnit, getMax, hasNext, dragListeners, dragAttributes, isDragging }: ExerciseRowProps) {
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
    <SwipeableRow
      className="mb-2 rounded-[10px]"
      actions={[{ label: 'Delete', icon: <SetTrashIcon />, color: '#c0392b', onClick: onDelete }]}
    >
    <div
      className="bg-[#2a2a4a] rounded-[10px] p-3 border border-[#3a3a5a]"
      style={isDragging ? { boxShadow: '0 8px 24px rgba(0,0,0,0.6)', border: '1.5px solid #6c63ff', transform: 'scale(1.03)' } : undefined}
      {...(dragAttributes ?? {})}
      {...(dragListeners ?? {})}
    >
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
        <ExerciseEditControls ex={ex} idx={idx} act={act} weightUnit={weightUnit} getMax={getMax} />
        {expanded && (
          <div className="mt-3 pt-3 border-t border-[#3a3a5a]">
            <PerSetEditor ex={ex} idx={idx} act={act} weightUnit={weightUnit} getMax={getMax} hasNext={hasNext} />
          </div>
        )}
      </div>
    </div>
    </SwipeableRow>
  )
}

// Group contiguous exercises that share the same non-null supersetGroup letter
// into runs. Each run is [startIdx, ...indices]; runs of length ≥2 get a bracket.
function groupRuns(exercises: EditableExercise[]): number[][] {
  const runs: number[][] = []
  let i = 0
  while (i < exercises.length) {
    const g = exercises[i].supersetGroup
    if (g == null) {
      runs.push([i])
      i++
      continue
    }
    const run = [i]
    let j = i + 1
    while (j < exercises.length && exercises[j].supersetGroup === g) {
      run.push(j)
      j++
    }
    runs.push(run)
    i = j
  }
  return runs
}

interface SortableExerciseRowProps {
  ex: EditableExercise
  idx: number
  focusIdx: number | null
  setFocusIdx: (i: number | null) => void
  act: (a: Action) => void
  onDeleteExercise: (index: number, exercise: EditableExercise) => void
  chipSource: string[]
  weightUnit: string
  getMax?: GetMax
  exerciseCount: number
}

function SortableExerciseRow({ ex, idx, focusIdx, setFocusIdx, act, onDeleteExercise, chipSource, weightUnit, getMax, exerciseCount }: SortableExerciseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : transition ?? undefined,
        zIndex: isDragging ? 10 : undefined,
        position: 'relative',
      }}
    >
      <ExerciseRow
        ex={ex}
        idx={idx}
        focusIdx={focusIdx}
        onFocused={() => setFocusIdx(null)}
        onRename={(name) => act({ type: 'renameExercise', ex: idx, name })}
        onDelete={() => onDeleteExercise(idx, ex)}
        act={act}
        knownExercises={chipSource}
        weightUnit={weightUnit}
        getMax={getMax}
        hasNext={idx < exerciseCount - 1}
        dragListeners={listeners}
        dragAttributes={attributes}
        isDragging={isDragging}
      />
    </div>
  )
}

interface ExerciseListProps {
  cardId: string
  exercises: EditableExercise[]
  focusIdx: number | null
  setFocusIdx: (i: number | null) => void
  act: (a: Action) => void
  onDeleteExercise: (index: number, exercise: EditableExercise) => void
  chipSource: string[]
  weightUnit: string
  getMax?: GetMax
}

// No private DndContext — a single context in RoutinesTab spans all cards so
// exercises can be dragged between them. This list is one droppable container
// (id = the card's stable id); empty cards keep a small drop zone.
function ExerciseList({ cardId, exercises, focusIdx, setFocusIdx, act, onDeleteExercise, chipSource, weightUnit, getMax }: ExerciseListProps) {
  const runs = groupRuns(exercises)
  const { setNodeRef } = useDroppable({ id: cardId })

  return (
    <div ref={setNodeRef} style={{ minHeight: exercises.length === 0 ? 28 : undefined }}>
      <SortableContext id={cardId} items={exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        {runs.map((run) => {
          const isSuperset = run.length >= 2
          const rows = run.map((i) => (
            <SortableExerciseRow
              key={exercises[i].id}
              ex={exercises[i]}
              idx={i}
              focusIdx={focusIdx}
              setFocusIdx={setFocusIdx}
              act={act}
              onDeleteExercise={onDeleteExercise}
              chipSource={chipSource}
              weightUnit={weightUnit}
              getMax={getMax}
              exerciseCount={exercises.length}
            />
          ))
          if (!isSuperset) return rows
          return (
            <div key={`run-${run[0]}`} className="relative">
              <SupersetBracket />
              {rows}
            </div>
          )
        })}
      </SortableContext>
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
  getMax?: GetMax
  onRegister?: RegisterCard
  onUnregister?: UnregisterCard
  activeOverCardId?: string | null
  activeSourceCardId?: string | null
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
  getMax,
  onRegister,
  onUnregister,
  activeOverCardId,
  activeSourceCardId,
}: ExpandableRoutineCardProps) {
  const cardId = useId()
  const isDropTarget = !!activeOverCardId && activeOverCardId === cardId && activeSourceCardId !== cardId
  const [expanded, setExpanded] = useState(initialExpanded)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const undoToast = useUndoToast()
  const { editing, onFocusCapture, onBlurCapture } = useCardEditing()

  const allRowsRef = useRef(allRows)
  allRowsRef.current = allRows

  const mutateCacheRef = useRef(mutateCache)
  mutateCacheRef.current = mutateCache

  const stableOnSaved = useCallback((savedRows: RoutineRow[]) => {
    // saveRoutineRows returns the full updated tab already in order; set it directly.
    // (The old filter+re-append mis-treated this whole-tab array as one routine's rows,
    // which re-sorted the list — e.g. pushing a new routine to the top.)
    mutateCacheRef.current(savedRows)
  }, [])

  const initial = toEditable(routine.rows)
  const { state, status, act, flush } = useRoutineEditor(spreadsheetId, initial, stableOnSaved, editing)

  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    onRegister?.(cardId, { getExercises: () => stateRef.current.exercises, act })
    return () => onUnregister?.(cardId)
  }, [cardId, onRegister, onUnregister, act])

  const handleStart = useCallback(async () => {
    const rows = toRows(state)
    try { await flush() } catch { /* offline — start from in-memory state anyway */ }
    onStartWorkout(rows)
  }, [state, flush, onStartWorkout])

  const handleDeleteExercise = useCallback((index: number, exercise: EditableExercise) => {
    act({ type: 'removeExercise', ex: index })
    undoToast.show('Exercise removed', () => act({ type: 'insertExercise', index, exercise }))
  }, [act, undoToast])

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
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      className={`bg-[#2a2a4a] rounded-[10px] overflow-hidden border transition-colors ${isDropTarget ? 'border-[#6c63ff] ring-1 ring-[#6c63ff]' : 'border-transparent'}`}
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
          onClick={(e) => { e.stopPropagation(); handleStart() }}
          className="flex-shrink-0 bg-[#6c63ff] rounded-full px-3 py-1 text-[12px] font-semibold active:opacity-80"
        >
          Start
        </button>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-[#3a3a5a]">
          <div className="pt-3 pl-2">
            <ExerciseList
              cardId={cardId}
              exercises={state.exercises}
              focusIdx={focusIdx}
              setFocusIdx={setFocusIdx}
              act={act}
              onDeleteExercise={handleDeleteExercise}
              chipSource={chipSource}
              weightUnit={weightUnit}
              getMax={getMax}
            />

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
      {undoToast.pending && <UndoToast message={undoToast.pending.message} onUndo={undoToast.undo} />}
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
  onDiscard: () => void
  weightUnit: string
  getMax?: GetMax
  onRegister?: RegisterCard
  onUnregister?: UnregisterCard
  activeOverCardId?: string | null
  activeSourceCardId?: string | null
}

export function DraftRoutineCard({
  program,
  spreadsheetId,
  allRows,
  loggedExercises,
  mutateCache,
  onSavedToList: _onSavedToList,
  onNameChange,
  onDiscard,
  weightUnit,
  getMax,
  onRegister,
  onUnregister,
  activeOverCardId,
  activeSourceCardId,
}: DraftRoutineCardProps) {
  const cardId = useId()
  const isDropTarget = !!activeOverCardId && activeOverCardId === cardId && activeSourceCardId !== cardId
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const undoToast = useUndoToast()
  const { editing, onFocusCapture, onBlurCapture } = useCardEditing()

  const allRowsRef = useRef(allRows)
  allRowsRef.current = allRows

  const mutateCacheRef = useRef(mutateCache)
  mutateCacheRef.current = mutateCache

  const stableOnSaved = useCallback((savedRows: RoutineRow[]) => {
    // saveRoutineRows returns the full updated tab already in order; set it directly.
    // (The old filter+re-append mis-treated this whole-tab array as one routine's rows,
    // which re-sorted the list — e.g. pushing a new routine to the top.)
    mutateCacheRef.current(savedRows)
  }, [])

  const initial: EditableRoutine = { program, routine: 'New Routine', exercises: [] }
  const { state, status, act } = useRoutineEditor(spreadsheetId, initial, stableOnSaved, editing)

  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    onRegister?.(cardId, { getExercises: () => stateRef.current.exercises, act })
    return () => onUnregister?.(cardId)
  }, [cardId, onRegister, onUnregister, act])

  const handleDeleteExercise = useCallback((index: number, exercise: EditableExercise) => {
    act({ type: 'removeExercise', ex: index })
    undoToast.show('Exercise removed', () => act({ type: 'insertExercise', index, exercise }))
  }, [act, undoToast])

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
    <div
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      className={`bg-[#2a2a4a] rounded-[10px] mb-2 overflow-hidden border transition-colors ${isDropTarget ? 'border-[#6c63ff] ring-1 ring-[#6c63ff]' : 'border-[#6c63ff]/40'}`}
    >
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
        <button
          type="button"
          onClick={onDiscard}
          aria-label="Discard draft routine"
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 active:opacity-80"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-3.5 pb-3.5 border-t border-[#3a3a5a]">
        <div className="pt-3 pl-2">
          <ExerciseList
            cardId={cardId}
            exercises={state.exercises}
            focusIdx={focusIdx}
            setFocusIdx={setFocusIdx}
            act={act}
            onDeleteExercise={handleDeleteExercise}
            chipSource={chipSource}
            weightUnit={weightUnit}
            getMax={getMax}
          />

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
      {undoToast.pending && <UndoToast message={undoToast.pending.message} onUndo={undoToast.undo} />}
    </div>
  )
}
