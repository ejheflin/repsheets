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

  const saveNow = useCallback(async () => {
    const s = stateRef.current
    setStatus('saving')
    try {
      const saved = await saveRoutineRows(spreadsheetId, s.program, s.routine, toRows(s))
      dirty.current = false
      onSavedRef.current(saved)
      setStatus('saved')
    } catch (err) {
      setStatus('error')
      throw err
    }
  }, [spreadsheetId])

  const runSave = useCallback((delay: number) => {
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { saveNow().catch(() => {}) }, delay)
  }, [saveNow])

  // Flush any pending change immediately and resolve once persisted. Used before
  // starting a workout so a just-added exercise can't be lost to a debounced save.
  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (!dirty.current) return
    await saveNow()
  }, [saveNow])

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

  // Best-effort flush if the app is backgrounded/closed with a pending edit —
  // the request may not complete on a hard kill, but it beats guaranteed loss
  useEffect(() => {
    const onHide = () => {
      if (dirty.current) saveNow().catch(() => {})
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [saveNow])

  const act = useCallback((a: Action) => dispatch(a), [])
  return { state, status, act, flush }
}
