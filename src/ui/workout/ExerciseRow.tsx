import { useState } from 'react'
import { SetRow } from './SetRow'
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
  onToggleExpand: () => void
  onToggleExercise: () => void
  onToggleSet: (setIdx: number) => void
  onUpdateSet: (setIdx: number, field: 'reps' | 'value', val: number | null) => void
  onUpdateAllSets: (field: 'reps' | 'value', val: number | null) => void
  onUpdateNotes: (notes: string) => void
  onAddSet: () => void
  tourId?: string
}

export function ExerciseRow({
  exercise,
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
              className={`w-10 bg-[#1a1a2e] rounded text-center text-sm font-semibold py-1 outline-none [appearance:textfield] ${repsHasMismatch ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
              placeholder="—" />
            <button
              onClick={() => onUpdateAllSets('reps', (summaryReps ?? 0) + 1)}
              className="w-6 h-6 rounded bg-[#1a1a2e] text-gray-400 text-sm flex items-center justify-center active:bg-[#3a3a5a]"
            >+</button>
          </div>
          <div className="flex-1 text-center">
            <input type="text" inputMode="decimal" value={summaryValue ?? ''}
              onChange={(e) => onUpdateAllSets('value', e.target.value ? Number(e.target.value) : null)}
              onFocus={(e) => e.target.select()}
              className={`w-16 bg-[#1a1a2e] rounded text-center text-sm font-semibold py-1 outline-none [appearance:textfield] ${valueHasMismatch ? 'ring-1 ring-red-500' : 'focus:ring-1 focus:ring-[#6c63ff]'}`}
              placeholder="—" />
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
        <button onClick={onToggleExercise}>
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
          <div className="flex-1 text-center">{unit || 'Value'}</div>
          <div className="w-7" />
        </div>
        {exercise.sets.map((set, setIdx) => (
          <SetRow key={set.setNumber} setNumber={set.setNumber} reps={set.reps}
            value={set.value} unit={unit} completed={set.completed}
            repsFlag={set.reps !== summaryReps}
            valueFlag={set.value !== summaryValue}
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
