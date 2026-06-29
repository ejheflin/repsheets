import { useState, useCallback, useRef } from 'react'
import { useRoutineEditor } from '../../data/useRoutineEditor'
import { toEditable } from '../../data/routineModel'
import { formatValue } from '../../data/measure'
import type { EditableRoutine, RoutineRow } from '../../types'

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

interface ExpandableRoutineCardProps {
  routine: { name: string; exercises: string[]; rows: RoutineRow[] }
  spreadsheetId: string
  allRows: RoutineRow[]
  mutateCache: (rows: RoutineRow[]) => void
  onStartWorkout: (rows: RoutineRow[]) => void
  initialExpanded?: boolean
  tourId?: string
}

export function ExpandableRoutineCard({
  routine,
  spreadsheetId,
  allRows,
  mutateCache,
  onStartWorkout,
  initialExpanded = false,
  tourId,
}: ExpandableRoutineCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [addName, setAddName] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)

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

  const handleAdd = () => {
    const name = addName.trim()
    if (!name) return
    act({ type: 'addExercise', name, unit: defaultUnit })
    setAddName('')
    setShowAddInput(false)
  }

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
            {state.exercises.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No exercises yet. Add one below.</p>
            )}

            {state.exercises.map((ex, i) => (
              <div
                key={`${ex.exercise}-${i}`}
                className="bg-[#1a1a2e] rounded-[10px] p-3 mb-2 flex items-center gap-3"
              >
                {/* TODO Task 8: rich measure-aware editable card */}
                {/* TODO Task 8: swipe-to-delete via SwipeableRow */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] truncate">{ex.exercise}</div>
                  <div className="text-[12px] text-gray-500 mt-0.5">{buildScheme(ex)}</div>
                </div>
              </div>
            ))}

            {/* TODO Task 10 — replace with AddExercisePicker */}
            {showAddInput ? (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                  className="flex-1 bg-[#1a1a2e] border border-[#3a3a5a] rounded-[10px] px-3 py-2.5 text-white outline-none focus:border-[#6c63ff] placeholder-gray-600"
                  style={{ fontSize: 16 }}
                  placeholder="Exercise name"
                  autoFocus
                />
                <button
                  onClick={handleAdd}
                  disabled={!addName.trim()}
                  className="bg-[#6c63ff] rounded-[10px] px-4 py-2.5 font-semibold text-sm active:opacity-80 disabled:opacity-40 flex-shrink-0"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddInput(true)}
                className="w-full mt-2 rounded-[10px] border border-dashed border-[#3a3a5a] bg-transparent flex items-center justify-center py-3 text-[#6c63ff] text-sm font-semibold active:opacity-80"
              >
                + Add exercise
              </button>
            )}
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
  mutateCache: (rows: RoutineRow[]) => void
  onSavedToList: () => void
  onNameChange: (name: string) => void
}

export function DraftRoutineCard({
  program,
  spreadsheetId,
  allRows,
  mutateCache,
  onSavedToList: _onSavedToList,
  onNameChange,
}: DraftRoutineCardProps) {
  const [addName, setAddName] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)

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

  const handleAdd = () => {
    const name = addName.trim()
    if (!name) return
    act({ type: 'addExercise', name, unit: defaultUnit })
    setAddName('')
    setShowAddInput(false)
  }

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
          {state.exercises.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No exercises yet. Add one below.</p>
          )}

          {state.exercises.map((ex, i) => (
            <div
              key={`${ex.exercise}-${i}`}
              className="bg-[#1a1a2e] rounded-[10px] p-3 mb-2 flex items-center gap-3"
            >
              {/* TODO Task 8: rich measure-aware editable card */}
              {/* TODO Task 8: swipe-to-delete via SwipeableRow */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14px] truncate">{ex.exercise}</div>
                <div className="text-[12px] text-gray-500 mt-0.5">{buildScheme(ex)}</div>
              </div>
            </div>
          ))}

          {/* TODO Task 10 — replace with AddExercisePicker */}
          {showAddInput ? (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                className="flex-1 bg-[#1a1a2e] border border-[#3a3a5a] rounded-[10px] px-3 py-2.5 text-white outline-none focus:border-[#6c63ff] placeholder-gray-600"
                style={{ fontSize: 16 }}
                placeholder="Exercise name"
                autoFocus
              />
              <button
                onClick={handleAdd}
                disabled={!addName.trim()}
                className="bg-[#6c63ff] rounded-[10px] px-4 py-2.5 font-semibold text-sm active:opacity-80 disabled:opacity-40 flex-shrink-0"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddInput(true)}
              className="w-full mt-2 rounded-[10px] border border-dashed border-[#3a3a5a] bg-transparent flex items-center justify-center py-3 text-[#6c63ff] text-sm font-semibold active:opacity-80"
            >
              + Add exercise
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
