import { useState, useRef, useEffect } from 'react'
import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { SetRow } from './SetRow'
import { PlateCalculator } from './PlateCalculator'
import { ExerciseMaxSettings } from './ExerciseMaxSettings'
import { SwipeableRow } from '../shared/SwipeableRow'
import type { SwipeAction } from '../shared/SwipeableRow'
import { rpeToPct, rirToPct } from '../../workout/rpe'
import { roundWeight, measureOf } from '../../data/measure'
import { TimeInput } from './TimeInput'
import type { WorkoutExercise, WorkoutSet, ExerciseSettings } from '../../types'
import { parseNumericInput } from '../../utils'
import { useDecimalInput } from '../shared/useDecimalInput'

function SwapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="8" height="24" viewBox="0 0 8 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 6 6 12 2 18" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 4 6 8 10 4" />
    </svg>
  )
}

function NotesIcon({ hasNotes }: { hasNotes: boolean }) {
  const color = hasNotes ? '#6c63ff' : '#555'
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 1H3a1 1 0 00-1 1v12a1 1 0 001 1h7l4-4V2a1 1 0 00-1-1z" />
      <polyline points="10 14 10 10 14 10" />
      <line x1="5" y1="5" x2="11" y2="5" />
      <line x1="5" y1="8" x2="9" y2="8" />
    </svg>
  )
}

interface ExerciseRowProps {
  exercise: WorkoutExercise
  programName?: string
  oneRepMax?: number | null
  rawOneRepMax?: number | null
  calculatedE1RM?: number | null
  exerciseSettings?: ExerciseSettings
  onSaveSettings?: (s: ExerciseSettings) => void
  onToggleExpand: () => void
  onToggleExercise: () => void
  onToggleSet: (setIdx: number) => void
  onUpdateSet: (setIdx: number, field: 'reps' | 'value' | 'achievedRpe' | 'achievedRir', val: number | null) => void
  onUpdateAllSets: (field: 'reps' | 'value' | 'achievedRpe' | 'achievedRir', val: number | null) => void
  onUpdateNotes: (notes: string) => void
  onAddSet?: () => void
  onShowHistory?: () => void
  onRemoveExercise: () => void
  onRenameExercise: (newName: string) => void
  onRemoveSet: (setIdx: number) => void
  historyExercises?: string[]
  dragHandleListeners?: SyntheticListenerMap
  dragAttributes?: DraggableAttributes
  isDragging?: boolean
  isPR?: boolean
  tourId?: string
}

/** Compute target weight from pct + 1RM, rounded to the unit's increment, or null. */
function targetWeight(pct: number | null | undefined, orm: number | null | undefined, unit: string): number | null {
  if (pct == null || orm == null) return null
  return roundWeight(pct * orm / 100, unit)
}

/** Compute target weight from rpe/rir + raw (pre-TM) e1rm, rounded to the unit's increment, or null. */
function rpeRirTarget(set: WorkoutSet, rawOrm: number | null | undefined, unit: string): number | null {
  if (rawOrm == null) return null
  const reps = set.reps ?? 1
  if (set.rpe != null) return roundWeight(rpeToPct(reps, set.rpe) * rawOrm, unit)
  if (set.rir != null) return roundWeight(rirToPct(reps, set.rir) * rawOrm, unit)
  return null
}

/** Resolved per-set target: absolute value, else pct×orm, else rpe/rir×rawOrm. */
function resolveSetTarget(
  set: WorkoutSet,
  orm: number | null | undefined,
  rawOrm: number | null | undefined,
  unit: string
): number | null {
  if (set.value != null) return set.value
  if (set.pct != null) return targetWeight(set.pct, orm, unit)
  if (set.rpe != null || set.rir != null) return rpeRirTarget(set, rawOrm, unit)
  return null
}

/** Build slashed target string for collapsed view, truncated to maxLen chars. */
function buildSlashedTargets(
  sets: WorkoutExercise['sets'],
  orm: number | null | undefined,
  rawOrm: number | null | undefined,
  unit: string,
  maxLen = 18
): string {
  const parts: string[] = []
  let result = ''
  for (const s of sets) {
    const tw = s.pct != null
      ? targetWeight(s.pct, orm, unit)
      : (s.rpe != null || s.rir != null) && s.value == null
        ? rpeRirTarget(s, rawOrm, unit)
        : s.value
    const part = tw != null ? String(Math.round(tw)) : '?'
    const next = parts.length === 0 ? part : `${result}/${part}`
    if (next.length > maxLen) {
      result = `${result}/…`
      break
    }
    parts.push(part)
    result = next
  }
  return result
}

export function ExerciseRow({
  exercise,
  programName,
  oneRepMax,
  rawOneRepMax,
  calculatedE1RM,
  exerciseSettings,
  onSaveSettings,
  onToggleExpand, onToggleExercise, onToggleSet, onUpdateSet, onUpdateAllSets, onUpdateNotes, onAddSet, onShowHistory, onRemoveExercise, onRenameExercise, onRemoveSet, historyExercises, dragHandleListeners, dragAttributes, isDragging, isPR, tourId,
}: ExerciseRowProps) {
  const [showNotes, setShowNotes] = useState(false)
  const [showMaxSettings, setShowMaxSettings] = useState(false)
  const [showSwap, setShowSwap] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [swapName, setSwapName] = useState(exercise.exercise)
  const [deletingSetIdx, setDeletingSetIdx] = useState<number | null>(null)

  const summaryValueRef = useRef<HTMLInputElement>(null)
  const prevSummaryValue = useRef(exercise.sets[0]?.value ?? null)
  // Sticky: true once the user types, reset only on (re)focus — never per-render.
  // The old per-render reset let the select-on-appear effect re-select a digit the
  // user had just typed, clobbering the next keystrokes.
  const summaryValueUserTyped = useRef(false)
  useEffect(() => {
    const current = exercise.sets[0]?.value ?? null
    const prev = prevSummaryValue.current
    prevSummaryValue.current = current
    if (current != null && prev == null && !summaryValueUserTyped.current && document.activeElement === summaryValueRef.current) {
      summaryValueRef.current?.select()
    }
  }, [exercise.sets])
  const allCompleted = exercise.sets.every((s) => s.completed)
  const unit = exercise.sets[0]?.unit ?? ''
  // Collapsed cards have no column header, so label the value box for non-weight
  // measures (time/distance) where the raw number needs a unit for context.
  const unitMeasure = measureOf(unit)
  const isTime = unitMeasure === 'time'
  const showUnitLabel = isTime || unitMeasure === 'distance'
  const unitLabel = isTime ? 'mm:ss' : unit

  const summaryReps = exercise.sets[0]?.reps ?? null
  const summaryValue = exercise.sets[0]?.value ?? null
  const summaryValueInput = useDecimalInput(summaryValue, (n) => onUpdateAllSets('value', n))

  const repsHasMismatch = exercise.sets.some((s) => s.reps !== summaryReps)
  const valueHasMismatch = exercise.sets.some((s) => s.value !== summaryValue)

  const userNotes = exercise.userNotes ?? ''
  const hasUserNotes = userNotes.length > 0

  // Percentage set detection (unchanged for pct routines)
  const firstPct = exercise.sets[0]?.pct ?? null
  const allSamePct = exercise.sets.every((s) => (s.pct ?? null) === firstPct)
  // Show slashed targets when pcts differ across sets (or mix of pct + absolute)
  const showPctSlashedTargets = exercise.sets.some((s) => s.pct != null) && !allSamePct
  const hasAnyPct = exercise.sets.some((s) => s.pct != null)

  // RPE/RIR detection — additive, only when no pct is present on the exercise
  const hasAnyRpeRir = !hasAnyPct && exercise.sets.some((s) => s.rpe != null || s.rir != null)
  const firstRpe = exercise.sets[0]?.rpe ?? null
  const firstRir = exercise.sets[0]?.rir ?? null
  const allSameRpeRir = exercise.sets.every(
    (s) => (s.rpe ?? null) === firstRpe && (s.rir ?? null) === firstRir
  )
  const showRpeRirSlashedTargets = hasAnyRpeRir && !allSameRpeRir

  const showSlashedTargets = showPctSlashedTargets || showRpeRirSlashedTargets

  // Single middle "intensity" column: a % target display for pct exercises, or an
  // editable achieved-RPE/RIR box for effort-based ones (also shown in edit mode
  // when a set carries a logged achieved value). There is no separate RPE column.
  const rpeMode = !hasAnyPct && exercise.sets.some(
    (s) => s.rpe != null || s.rir != null || s.achievedRpe != null || s.achievedRir != null
  )
  const showTargetColumn = hasAnyPct || rpeMode
  const achievedIsRir =
    !exercise.sets.some((s) => s.rpe != null || s.achievedRpe != null) &&
    exercise.sets.some((s) => s.rir != null || s.achievedRir != null)
  const intensityLabel = hasAnyPct ? 'Target' : achievedIsRir ? 'RIR' : 'RPE'
  const intensityMode: 'pct' | 'rpe' | 'rir' | null =
    hasAnyPct ? 'pct' : rpeMode ? (achievedIsRir ? 'rir' : 'rpe') : null
  // Collapsed-card summaries (edit all sets at once), defaulting to the prescription.
  const firstSet = exercise.sets[0]
  // Reps prescription designation (uniform across sets in practice): AMRAP / a range.
  const repsPrescription = firstSet?.repsOpen
    ? 'AMRAP'
    : firstSet?.repsMax != null ? `${firstSet.reps ?? ''}–${firstSet.repsMax}` : null
  const summaryAchievedRpe = firstSet?.achievedRpe ?? firstSet?.rpe ?? null
  const summaryAchievedRir = firstSet?.achievedRir ?? firstSet?.rir ?? null
  // Draft buffers so half-steps (8.5) are typable and NaN can never be stored
  const summaryRpeInput = useDecimalInput(summaryAchievedRpe, (v) =>
    onUpdateAllSets('achievedRpe', v == null ? null : Math.min(10, Math.max(1, v))))
  const summaryRirInput = useDecimalInput(summaryAchievedRir, (v) =>
    onUpdateAllSets('achievedRir', v == null ? null : Math.min(10, Math.max(0, v))))
  const rpeHasMismatch = exercise.sets.some((s) => (s.achievedRpe ?? s.rpe ?? null) !== summaryAchievedRpe)
  const rirHasMismatch = exercise.sets.some((s) => (s.achievedRir ?? s.rir ?? null) !== summaryAchievedRir)

  // One grid template shared by the header and every set row, so columns line up.
  const gridCols = [
    '1.75rem',                                                      // Set
    'minmax(5rem,1.25fr)',                                          // Reps (wider — the +/− buttons eat into it)
    showTargetColumn ? (hasAnyPct ? '4rem' : '3.25rem') : null,     // Target(%) display or RPE/RIR input
    'minmax(min-content,1fr)',                                      // Value
    '1.75rem',                                                      // ✓
  ].filter(Boolean).join(' ')

  const routineBasis: '1rm' | 'tm' | undefined =
    exercise.sets.some((s) => s.basis === 'tm') ? 'tm'
    : exercise.sets.some((s) => s.pct != null) ? '1rm'
    : undefined

  // Plate calculator: next unchecked set, or last set once all are done
  const plateSet = exercise.sets.find((s) => !s.completed) ?? exercise.sets[exercise.sets.length - 1]
  const nextPlateWeight = plateSet
    ? (plateSet.value ?? resolveSetTarget(plateSet, oneRepMax, rawOneRepMax, unit))
    : null

  const notesInput = showNotes ? (
    <div className="mt-1.5 ml-5">
      <input
        type="text"
        value={userNotes}
        onChange={(e) => onUpdateNotes(e.target.value)}
        className="w-full bg-[#1a1a2e] border border-[#3a3a5a] rounded text-gray-300 px-2 py-1.5 outline-none focus:border-[#6c63ff]" style={{ fontSize: 16 }}
        placeholder="Add a note..."
        autoFocus
      />
    </div>
  ) : null

  const swipeActions: SwipeAction[] = [
    {
      label: 'Swap',
      icon: <SwapIcon />,
      color: '#5c5ccc',
      onClick: () => { setSwapName(exercise.exercise); setShowSwap(true) },
    },
    {
      label: 'Delete',
      icon: <TrashIcon />,
      color: '#c0392b',
      onClick: () => setShowDeleteConfirm(true),
    },
  ]

  if (!exercise.isExpanded) {
    return (
      <>
        <SwipeableRow actions={swipeActions} className="mb-1.5 rounded-[10px]">
          <div
            data-tour={tourId ? 'exercise-row' : undefined}
            className="relative bg-[#2a2a4a] rounded-[10px] px-3 py-2.5"
            style={isDragging
              ? { boxShadow: '0 8px 24px rgba(0,0,0,0.6)', border: '1.5px solid #6c63ff', transform: 'scale(1.03)' }
              : isPR ? { border: '1.5px solid #6c63ff', boxShadow: '0 0 12px rgba(108,99,255,0.25)' }
              : undefined}
          >
            <div className="grid gap-y-1.5" style={{ gridTemplateColumns: 'auto auto auto auto auto', justifyContent: 'space-between' }}>

              {/* Row 1: exercise name spans cols 1-3, plate calc col 4, checkbox col 5 */}
              <div className="flex items-center min-w-0" style={{ gridColumn: '1 / 4' }}>
                <button onClick={onToggleExpand} className="mr-1.5 flex items-center self-stretch"><ChevronRight /></button>
                <button
                  onClick={onToggleExpand}
                  className="text-left min-w-0 flex items-center gap-1.5"
                  {...(dragHandleListeners ?? {})}
                  {...(dragAttributes ?? {})}
                >
                  <div className="min-w-0 overflow-hidden">
                    <div className="font-semibold text-sm truncate">{exercise.exercise}</div>
                    {exercise.notes && (
                      <div className="text-[10px] text-[#6c63ff] mt-0.5 truncate">▸ {exercise.notes}</div>
                    )}
                  </div>
                </button>
              </div>
              <div className="flex items-center justify-center">
                {showUnitLabel ? (
                  <span className="text-[9px] text-gray-500 leading-none uppercase tracking-wide">{unitLabel}</span>
                ) : nextPlateWeight ? (
                  <PlateCalculator weight={nextPlateWeight} unit={unit} exercise={exercise.exercise} />
                ) : null}
              </div>
              <button data-tour={tourId ? 'exercise-checkbox' : undefined} onClick={onToggleExercise} className="flex items-center justify-end">
                {allCompleted ? (
                  <div className="w-[22px] h-[22px] bg-[#6c63ff] rounded-md flex items-center justify-center text-xs">✓</div>
                ) : (
                  <div className="w-[22px] h-[22px] border-2 border-[#444] rounded-md" />
                )}
              </button>

              {/* Row 2: N×, reps, intensity, weight, icons — each in its own column */}
              <button onClick={onToggleExpand} className="text-xs text-gray-500 w-7 text-left flex items-center">{exercise.sets.length}×</button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUpdateAllSets('reps', Math.max(0, (summaryReps ?? 0) - 1))}
                  className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#3a3a5a]"
                >−</button>
                <input type="text" inputMode="numeric" value={summaryReps ?? ''}
                  onChange={(e) => { const n = parseNumericInput(e.target.value); if (n !== undefined) onUpdateAllSets('reps', n) }}
                  onFocus={(e) => e.target.select()}
                  className={`w-12 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${repsHasMismatch ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
                  placeholder="—" />
                <button
                  onClick={() => onUpdateAllSets('reps', (summaryReps ?? 0) + 1)}
                  className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#3a3a5a]"
                >+</button>
              </div>
              <div className="flex items-center justify-center">
                {intensityMode === 'pct' ? (
                  <button onClick={() => setShowMaxSettings(true)}
                    className="text-[13px] font-semibold text-gray-400 px-0.5 active:opacity-80 truncate">
                    {firstPct != null ? `${Math.round(firstPct)}%` : ''}
                  </button>
                ) : intensityMode === 'rpe' ? (
                  <input type="text" inputMode="decimal"
                    value={summaryRpeInput.text}
                    placeholder={firstSet?.rpe != null ? String(firstSet.rpe) : ''}
                    onChange={(e) => summaryRpeInput.handleChange(e.target.value)}
                    onBlur={summaryRpeInput.handleBlur}
                    onFocus={(e) => e.target.select()}
                    className={`w-11 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${rpeHasMismatch ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`} />
                ) : intensityMode === 'rir' ? (
                  <input type="text" inputMode="decimal"
                    value={summaryRirInput.text}
                    placeholder={firstSet?.rir != null ? String(firstSet.rir) : ''}
                    onChange={(e) => summaryRirInput.handleChange(e.target.value)}
                    onBlur={summaryRirInput.handleBlur}
                    onFocus={(e) => e.target.select()}
                    className={`w-11 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${rirHasMismatch ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`} />
                ) : null}
              </div>
              <div className="flex items-center justify-center">
                {showSlashedTargets ? (
                  <button
                    onClick={() => setShowMaxSettings(true)}
                    className="text-sm font-semibold text-gray-300 px-1 active:opacity-80"
                  >
                    {buildSlashedTargets(exercise.sets, oneRepMax, rawOneRepMax, unit)}
                  </button>
                ) : isTime ? (
                  <TimeInput value={summaryValue} onChange={(v) => onUpdateAllSets('value', v)}
                    className={`w-16 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${valueHasMismatch ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`} />
                ) : (
                  <input ref={summaryValueRef} type="text" inputMode="decimal" value={summaryValueInput.text}
                    onChange={(e) => { summaryValueUserTyped.current = true; summaryValueInput.handleChange(e.target.value) }}
                    onBlur={summaryValueInput.handleBlur}
                    onFocus={(e) => { summaryValueUserTyped.current = false; e.target.select() }}
                    className={`w-16 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${valueHasMismatch ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
                    placeholder="—" />
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                {onShowHistory && (
                  <button onClick={onShowHistory} className="flex items-center active:opacity-60">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M 2.5 8 A 5.5 5.5 0 1 0 4.1 4.1" />
                      <polyline points="6.3 3.2 4.1 4.1 4.4 1.8" />
                      <line x1="8" y1="5" x2="8" y2="8" />
                      <line x1="8" y1="8" x2="10" y2="10" />
                    </svg>
                  </button>
                )}
                <button onClick={() => setShowNotes(!showNotes)} className="flex items-center">
                  <NotesIcon hasNotes={hasUserNotes} />
                </button>
              </div>
            </div>
            {notesInput}
            {isPR && (
              <span className="absolute top-1.5 right-2 text-[10px] font-bold bg-[#6c63ff] text-white px-1.5 py-0.5 rounded-full leading-none pointer-events-none">
                PR
              </span>
            )}
          </div>
        </SwipeableRow>

        {showMaxSettings && (
          <ExerciseMaxSettings
            exerciseName={exercise.exercise}
            unit={unit}
            calculatedE1RM={calculatedE1RM ?? null}
            settings={exerciseSettings ?? {}}
            onSave={(s) => { onSaveSettings?.(s); setShowMaxSettings(false) }}
            onClose={() => setShowMaxSettings(false)}
          />
        )}

        {showSwap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowSwap(false)}>
            <div className="bg-[#2a2a4a] rounded-[10px] p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-[15px] mb-1">Swap Exercise</div>
              <div className="text-[13px] text-gray-400 mb-3">This only affects your current workout — the routine is not changed.</div>
              {historyExercises && historyExercises.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {historyExercises.map((name) => (
                    <button
                      key={name}
                      onClick={() => { onRenameExercise(name); setShowSwap(false) }}
                      className="flex-shrink-0 bg-[#3a3a5a] rounded-full px-3 py-1.5 text-sm text-white active:bg-[#6c63ff] active:opacity-80"
                    >{name}</button>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={swapName}
                onChange={(e) => setSwapName(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#6c63ff] rounded-[8px] px-3 py-2.5 text-sm outline-none"
                style={{ fontSize: 16 }}
                onFocus={(e) => e.target.select()}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setShowSwap(false); setSwapName(exercise.exercise) }}
                  className="flex-1 bg-[#1a1a2e] border border-[#3a3a5a] rounded-[10px] py-2.5 text-sm text-gray-400 active:opacity-80"
                >Cancel</button>
                <button
                  onClick={() => { onRenameExercise(swapName.trim()); setShowSwap(false) }}
                  disabled={!swapName.trim() || swapName.trim() === exercise.exercise}
                  className="flex-1 bg-[#6c63ff] rounded-[10px] py-2.5 text-sm font-semibold active:opacity-80 disabled:opacity-40"
                >Confirm</button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-[#2a2a4a] rounded-[10px] p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-[15px] mb-1">Remove Exercise?</div>
              <div className="text-[13px] text-gray-400 mb-4">"{exercise.exercise}" and all its sets will be removed from this workout.</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-[#1a1a2e] border border-[#3a3a5a] rounded-[10px] py-2.5 text-sm text-gray-400 active:opacity-80"
                >Cancel</button>
                <button
                  onClick={() => { onRemoveExercise(); setShowDeleteConfirm(false) }}
                  className="flex-1 bg-[#c0392b] rounded-[10px] py-2.5 text-sm font-semibold active:opacity-80"
                >Remove</button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div
      className="relative bg-[#2a2a4a] rounded-[10px] mb-1.5 px-3 py-2.5"
      style={isPR ? { border: '1.5px solid #6c63ff', boxShadow: '0 0 12px rgba(108,99,255,0.25)' } : undefined}
    >
      {/* Row 1 (name/plate/check) and row 2 (N×/reps/target/weight/icons) share one 5-col grid */}
      <div className="grid mb-2" style={{ gridTemplateColumns: '28px 104px auto auto auto', justifyContent: 'space-between' }}>
        <div className="flex items-center min-w-0" style={{ gridColumn: '1 / 4' }}>
          <button onClick={onToggleExpand} className="mr-1.5 flex items-center"><ChevronDown /></button>
          <button onClick={onToggleExpand} className="text-left min-w-0 overflow-hidden font-bold text-[15px] truncate">{exercise.exercise}</button>
        </div>
        <div className="flex items-center justify-center">
          {nextPlateWeight ? (
            <PlateCalculator weight={nextPlateWeight} unit={unit} exercise={exercise.exercise} />
          ) : null}
        </div>
        <button onClick={onToggleExercise} className="flex items-center justify-end">
          {allCompleted ? (
            <div className="w-[22px] h-[22px] bg-[#6c63ff] rounded-md flex items-center justify-center text-xs">✓</div>
          ) : (
            <div className="w-[22px] h-[22px] border-2 border-[#444] rounded-md" />
          )}
        </button>
      </div>
      {exercise.notes && (
        <div className="text-[10px] text-[#6c63ff] mb-2 ml-5">▸ {exercise.notes}</div>
      )}
      <div className="ml-5">
        <div className="grid items-center pb-1 text-[10px] text-gray-600 uppercase tracking-wider"
          style={{ gridTemplateColumns: gridCols }}>
          <div className="text-center">Set</div>
          <div className="text-center">{repsPrescription ?? 'Reps'}</div>
          {showTargetColumn && (
            hasAnyPct ? (
              <button onClick={() => setShowMaxSettings(true)}
                className="text-center active:opacity-80">
                {intensityLabel}
              </button>
            ) : (
              <div className="text-center">{intensityLabel}</div>
            )
          )}
          <div className="text-center">{isTime ? 'mm:ss' : unit || 'Value'}</div>
          <div />
        </div>
        {exercise.sets.map((set, setIdx) => {
          const isDeleting = deletingSetIdx === setIdx
          return (
            <div
              key={set.setNumber}
              className={setIdx < exercise.sets.length - 1 ? 'border-b border-[#3a3a5a]' : ''}
              style={{
                maxHeight: isDeleting ? 0 : '100px',
                opacity: isDeleting ? 0 : 1,
                overflow: 'hidden',
                transition: isDeleting ? 'max-height 0.25s ease, opacity 0.15s ease' : 'none',
              }}
              onTransitionEnd={(e) => {
                if (e.propertyName === 'max-height' && isDeleting) {
                  onRemoveSet(setIdx)
                  setDeletingSetIdx(null)
                }
              }}
            >
              <SwipeableRow
                actions={[{ label: 'Delete', icon: <TrashIcon />, color: '#c0392b', onClick: () => setDeletingSetIdx(setIdx) }]}
              >
                <SetRow setNumber={set.setNumber} reps={set.reps}
                  value={set.value} unit={unit} completed={set.completed}
                  pct={set.pct}
                  rpe={set.rpe}
                  rir={set.rir}
                  achievedRpe={set.achievedRpe}
                  achievedRir={set.achievedRir}
                  gridCols={gridCols}
                  showTargetColumn={showTargetColumn}
                  oneRepMax={oneRepMax}
                  rawOneRepMax={rawOneRepMax}
                  repsFlag={set.reps !== summaryReps}
                  valueFlag={!showSlashedTargets && set.value !== summaryValue}
                  onToggle={() => onToggleSet(setIdx)}
                  onRepsChange={(v) => onUpdateSet(setIdx, 'reps', v)}
                  onValueChange={(v) => onUpdateSet(setIdx, 'value', v)}
                  onAchievedRpeChange={(v) => onUpdateSet(setIdx, 'achievedRpe', v)}
                  onAchievedRirChange={(v) => onUpdateSet(setIdx, 'achievedRir', v)}
                  onTargetClick={(set.pct != null || set.rpe != null || set.rir != null) ? () => setShowMaxSettings(true) : undefined} />
              </SwipeableRow>
            </div>
          )
        })}
        <div className="flex items-center mt-1">
          {onAddSet && (
            <button onClick={onAddSet}
              className="flex-1 text-center text-xs text-[#6c63ff] py-2 font-semibold">
              + Add Set
            </button>
          )}
          {onShowHistory && (
            <button onClick={onShowHistory} className="flex items-center justify-center py-2 px-1.5 active:opacity-60">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 2.5 8 A 5.5 5.5 0 1 0 4.1 4.1" />
                <polyline points="6.3 3.2 4.1 4.1 4.4 1.8" />
                <line x1="8" y1="5" x2="8" y2="8" />
                <line x1="8" y1="8" x2="10" y2="10" />
              </svg>
            </button>
          )}
          <button onClick={() => setShowNotes(!showNotes)} className="w-7 flex items-center justify-center py-2">
            <NotesIcon hasNotes={hasUserNotes} />
          </button>
        </div>
      </div>
      {notesInput}
      {showMaxSettings && (
        <ExerciseMaxSettings
          exerciseName={exercise.exercise}
          unit={unit}
          calculatedE1RM={calculatedE1RM ?? null}
          settings={exerciseSettings ?? {}}
          routineBasis={routineBasis}
          programName={programName}
          onSave={(s) => { onSaveSettings?.(s); setShowMaxSettings(false) }}
          onClose={() => setShowMaxSettings(false)}
        />
      )}
      {isPR && (
        <span className="absolute top-1.5 right-2 text-[10px] font-bold bg-[#6c63ff] text-white px-1.5 py-0.5 rounded-full leading-none pointer-events-none">
          PR
        </span>
      )}
    </div>
  )
}
