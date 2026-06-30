import { useReducer, useState, useEffect, useRef, useCallback } from 'react'
import { reduce, type Action } from './routineEditorReducer'
import { toRows } from './routineModel'
import { saveRoutineRows } from '../sheets/driveApi'
import type { EditableRoutine, RoutineRow } from '../types'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useRoutineEditor(
  spreadsheetId: string,
  initial: EditableRoutine,
  onSaved: (rows: RoutineRow[]) => void,
  editing = false,
) {
  const [state, dispatch] = useReducer(reduce, initial)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const first = useRef(true)
  const dirty = useRef(false)

  const stateRef = useRef(state)
  stateRef.current = state
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  const runSave = useCallback((delay: number) => {
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const s = stateRef.current
      try {
        const saved = await saveRoutineRows(spreadsheetId, s.program, s.routine, toRows(s))
        dirty.current = false
        onSavedRef.current(saved)
        setStatus('saved')
      } catch {
        setStatus('error')
      }
    }, delay)
  }, [spreadsheetId])

  // State changed: mark dirty. Defer the save while the user is editing within the
  // card (focus would be stolen by the resulting re-render / draft graduation).
  // When nothing is focused (e.g. a stepper tap that immediately blurs, or a
  // programmatic change) behave as before and debounce-save right away.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    dirty.current = true
    if (editing) {
      setStatus('saving')
      return
    }
    runSave(600)
    return () => clearTimeout(timer.current)
  }, [state, editing, runSave])

  // Focus left the card with a pending change: flush the deferred save now.
  useEffect(() => {
    if (editing || !dirty.current) return
    runSave(150)
    return () => clearTimeout(timer.current)
  }, [editing, runSave])

  const act = useCallback((a: Action) => dispatch(a), [])
  return { state, status, act }
}
