import { useState } from 'react'
import { SetRow } from './SetRow'
import { PlateCalculator } from './PlateCalculator'
import type { WorkoutExercise } from '../../types'

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
  oneRepMax?: number | null
  onToggleExpand: () => void
  onToggleExercise: () => void
  onToggleSet: (setIdx: number) => void
  onUpdateSet: (setIdx: number, field: 'reps' | 'value', val: number | null) => void
  onUpdateAllSets: (field: 'reps' | 'value', val: number | null) => void
  onUpdateNotes: (notes: string) => void
  onAddSet: () => void
  tourId?: string
}

/** Compute target weight from pct + 1RM, or null if either is missing. */
function targetWeight(pct: number | null | undefined, orm: number | null | undefined): number | null {
  if (pct == null || orm == null) return null
  return Math.round(pct * orm / 100)
}

/** Build slashed target string for collapsed view, truncated to maxLen chars. */
function buildSlashedTargets(sets: WorkoutExercise['sets'], orm: number | null | undefined, maxLen = 18): string {
  const parts: string[] = []
  let result = ''
  for (const s of sets) {
    const tw = s.pct != null ? targetWeight(s.pct, orm) : s.value
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
  oneRepMax,
  onToggleExpand, onToggleExercise, onToggleSet, onUpdateSet, onUpdateAllSets, onUpdateNotes, onAddSet, tourId,
}: ExerciseRowProps) {
  const [showNotes, setShowNotes] = useState(false)
  const allCompleted = exercise.sets.every((s) => s.completed)
  const unit = exercise.sets[0]?.unit ?? ''

  const summaryReps = exercise.sets[0]?.reps ?? null
  const summaryValue = exercise.sets[0]?.value ?? null

  const repsHasMismatch = exercise.sets.some((s) => s.reps !== summaryReps)
  const valueHasMismatch = exercise.sets.some((s) => s.value !== summaryValue)

  const userNotes = exercise.userNotes ?? ''
  const hasUserNotes = userNotes.length > 0

  // Percentage set detection
  const firstPct = exercise.sets[0]?.pct ?? null
  const allSamePct = exercise.sets.every((s) => (s.pct ?? null) === firstPct)
  // Show slashed targets when pcts differ across sets (or mix of pct + absolute)
  const showSlashedTargets = exercise.sets.some((s) => s.pct != null) && !allSamePct
  const hasAnyPct = exercise.sets.some((s) => s.pct != null)

  const notesInput = showNotes ? (
    <div className="mt-1.5 ml-5">
      <input
        type="text"
        value={userNotes}
        onChange={(e) => onUpdateNotes(e.target.value)}
        className="w-full bg-[#1a1a2e] border border-[#3a3a5a] rounded text-xs text-gray-300 px-2 py-1.5 outline-none focus:border-[#6c63ff]"
        placeholder="Add a note..."
        autoFocus
      />
    </div>
  ) : null

  if (!exercise.isExpanded) {
    return (
      <div data-tour={tourId ? 'exercise-row' : undefined} className="bg-[#2a2a4a] rounded-[10px] mb-1.5 px-3 py-2.5">
        <div className="flex items-center">
          <button onClick={onToggleExpand} className="mr-1.5 self-stretch flex items-center"><ChevronRight /></button>
          <button onClick={onToggleExpand} className="flex-1 text-left min-w-0">
            <div className="font-semibold text-sm truncate">{exercise.exercise}</div>
            {exercise.notes && (
              <div className="text-[10px] text-[#6c63ff] mt-0.5 truncate">▸ {exercise.notes}</div>
            )}
          </button>
          {summaryValue && !showSlashedTargets ? (
            <div className="flex-shrink-0 flex items-center mr-10">
              <PlateCalculator weight={summaryValue} unit={unit} exercise={exercise.exercise} />
            </div>
          ) : null}
          <button data-tour={tourId ? 'exercise-checkbox' : undefined} onClick={onToggleExercise} className="ml-2">
            {allCompleted ? (
              <div className="w-[22px] h-[22px] bg-[#6c63ff] rounded-md flex items-center justify-center text-xs">✓</div>
            ) : (
              <div className="w-[22px] h-[22px] border-2 border-[#444] rounded-md" />
            )}
          </button>
        </div>
        <div className="flex items-center mt-1.5 ml-5">
          <span className="text-xs text-gray-500 mr-2 w-7 flex-shrink-0">{exercise.sets.length}×</span>
          <div className="flex-1 flex items-center justify-center gap-1">
            <button
              onClick={() => onUpdateAllSets('reps', Math.max(0, (summaryReps ?? 0) - 1))}
              className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#3a3a5a]"
            >−</button>
            <input type="text" inputMode="numeric" value={summaryReps ?? ''}
              onChange={(e) => onUpdateAllSets('reps', e.target.value ? Number(e.target.value) : null)}
              onFocus={(e) => e.target.select()}
              className={`w-12 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${repsHasMismatch ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
              placeholder="—" />
            <button
              onClick={() => onUpdateAllSets('reps', (summaryReps ?? 0) + 1)}
              className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#3a3a5a]"
            >+</button>
          </div>
          <div className="flex-1 text-center">
            {showSlashedTargets ? (
              // Different pcts across sets: show calculated targets, tap to expand
              <button
                onClick={onToggleExpand}
                className="text-sm font-semibold text-gray-300 px-1"
              >
                {buildSlashedTargets(exercise.sets, oneRepMax)}
              </button>
            ) : (
              // All sets same pct (or no pct): normal editable weight input
              <input type="text" inputMode="decimal" value={summaryValue ?? ''}
                onChange={(e) => onUpdateAllSets('value', e.target.value ? Number(e.target.value) : null)}
                onFocus={(e) => e.target.select()}
                className={`w-16 bg-[#1a1a2e] rounded text-center text-base font-semibold py-1 outline-none [appearance:textfield] ${valueHasMismatch ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
                placeholder="—" />
            )}
          </div>
          <button onClick={() => setShowNotes(!showNotes)} className="w-7 flex items-center justify-center">
            <NotesIcon hasNotes={hasUserNotes} />
          </button>
        </div>
        {notesInput}
      </div>
    )
  }

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] mb-1.5 px-3 py-2.5">
      <div className="flex items-center mb-2">
        <button onClick={onToggleExpand} className="mr-1.5 flex items-center"><ChevronDown /></button>
        <button onClick={onToggleExpand} className="flex-1 text-left font-bold text-[15px]">{exercise.exercise}</button>
        {summaryValue && !hasAnyPct ? (
          <div className="flex-shrink-0 flex items-center mr-10">
            <PlateCalculator weight={summaryValue} unit={unit} exercise={exercise.exercise} />
          </div>
        ) : null}
        <button onClick={onToggleExercise} className="ml-2">
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
        <div className="flex pb-1 text-[10px] text-gray-600 uppercase tracking-wider">
          <div className="w-7">Set</div>
          <div className="flex-1 text-center">Reps</div>
          {hasAnyPct && <div className="w-16 text-right pr-1">Target</div>}
          <div className="flex-1 text-center">{unit || 'Value'}</div>
          <div className="w-7" />
        </div>
        {exercise.sets.map((set, setIdx) => (
          <SetRow key={set.setNumber} setNumber={set.setNumber} reps={set.reps}
            value={set.value} unit={unit} completed={set.completed}
            pct={set.pct}
            oneRepMax={oneRepMax}
            repsFlag={set.reps !== summaryReps}
            valueFlag={!showSlashedTargets && set.value !== summaryValue}
            onToggle={() => onToggleSet(setIdx)}
            onRepsChange={(v) => onUpdateSet(setIdx, 'reps', v)}
            onValueChange={(v) => onUpdateSet(setIdx, 'value', v)} />
        ))}
        <div className="flex items-center mt-1">
          <button onClick={onAddSet}
            className="flex-1 text-center text-xs text-[#6c63ff] py-2 font-semibold">
            + Add Set
          </button>
          <button onClick={() => setShowNotes(!showNotes)} className="w-7 flex items-center justify-center py-2">
            <NotesIcon hasNotes={hasUserNotes} />
          </button>
        </div>
      </div>
      {notesInput}
    </div>
  )
}
