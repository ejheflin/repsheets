import { useState, useCallback, useRef } from 'react'
import { useRoutineEditor } from '../../data/useRoutineEditor'
import { useSheetContext } from '../../data/useSheetContext'
import type { EditableRoutine, RoutineRow } from '../../types'

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

interface RoutineEditorProps {
  initial: EditableRoutine
  onBack: () => void
  onSaved: (rows: RoutineRow[]) => void
}

export function RoutineEditor({ initial, onBack, onSaved }: RoutineEditorProps) {
  const { spreadsheetId } = useSheetContext()

  // Keep a ref to the latest onSaved so the stable callback always calls the current version.
  // This lets handleEditorSaved in RoutinesTab keep fresh allRows without causing debounce resets.
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  const stableOnSaved = useCallback((rows: RoutineRow[]) => {
    onSavedRef.current(rows)
  }, [])

  const { state, status, act } = useRoutineEditor(spreadsheetId ?? '', initial, stableOnSaved)

  const [addName, setAddName] = useState('')

  const statusText =
    status === 'saving' ? 'Saving…' :
    status === 'saved' ? 'Saved' :
    status === 'error' ? 'Couldn’t save — retry' :
    ''

  const statusColor =
    status === 'error' ? 'text-red-400' :
    status === 'saving' ? 'text-gray-400' :
    'text-[#6c63ff]'

  const defaultUnit =
    state.exercises.length > 0 ? state.exercises[0].unit : 'lbs'

  const handleAdd = () => {
    const name = addName.trim()
    if (!name) return
    act({ type: 'addExercise', name, unit: defaultUnit })
    setAddName('')
  }

  return (
    <div className="fixed inset-0 bg-[#1a1a2e] z-40 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-[#3a3a5a] flex-shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center text-white active:opacity-80 flex-shrink-0"
          aria-label="Back"
        >
          <ChevronLeft />
        </button>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={state.routine}
            onChange={(e) => act({ type: 'setRoutine', name: e.target.value })}
            onFocus={(e) => e.target.select()}
            className="w-full bg-transparent font-bold text-white outline-none border-b border-transparent focus:border-[#6c63ff] transition-colors"
            style={{ fontSize: 16 }}
            placeholder="Routine name"
          />
          <div className="text-[11px] text-gray-500 mt-0.5 truncate">in {state.program}</div>
        </div>

        <div className={`text-[11px] flex-shrink-0 ${statusColor}`}>
          {statusText}
        </div>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        {state.exercises.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">No exercises yet. Add one below.</p>
        )}

        {state.exercises.map((ex, i) => {
          const setCount = ex.sets.length
          const reps = ex.sets[0]?.reps
          const summary = reps != null ? `${setCount} sets × ${reps} reps` : `${setCount} sets`
          return (
            <div
              key={`${ex.exercise}-${i}`}
              className="bg-[#2a2a4a] rounded-[10px] p-3.5 mb-2 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] truncate">{ex.exercise}</div>
                <div className="text-[12px] text-gray-500 mt-0.5">{summary}</div>
              </div>
              {/* TODO Task 8 — replace with EditableExerciseCard */}
              <button
                onClick={() => act({ type: 'removeExercise', ex: i })}
                className="w-8 h-8 flex items-center justify-center text-gray-500 active:opacity-80 flex-shrink-0"
                aria-label={`Remove ${ex.exercise}`}
              >
                <TrashIcon />
              </button>
            </div>
          )
        })}

        {/* TODO Task 10 — replace with AddExercisePicker */}
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            className="flex-1 bg-[#2a2a4a] border border-[#3a3a5a] rounded-[10px] px-3 py-2.5 text-white outline-none focus:border-[#6c63ff] placeholder-gray-600"
            style={{ fontSize: 16 }}
            placeholder="Exercise name"
          />
          <button
            onClick={handleAdd}
            disabled={!addName.trim()}
            className="bg-[#6c63ff] rounded-[10px] px-4 py-2.5 font-semibold text-sm active:opacity-80 disabled:opacity-40 flex-shrink-0"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
