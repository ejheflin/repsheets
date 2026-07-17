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
  // Drafts pass false until they're valid (named without collision, ≥1
  // exercise) — nothing may persist before that, or an empty draft named
  // like an existing routine would erase it
  persistEnabled = true,
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
  const enabledRef = useRef(persistEnabled)
  enabledRef.current = persistEnabled

  // Identity the routine is saved under on the sheet. Saving always targets
  // this name and only advances it on success — so a rename replaces the old
  // rows instead of duplicating them under the new name.
  const savedName = useRef({ program: initial.program, routine: initial.routine })

  const saveNow = useCallback(async () => {
    if (!enabledRef.current) { setStatus('idle'); return }
    const s = stateRef.current
    setStatus('saving')
    try {
      const saved = await saveRoutineRows(spreadsheetId, savedName.current, toRows(s))
      savedName.current = { program: s.program, routine: s.routine }
      // Only clear dirty if no newer edits arrived while this save was in
      // flight — otherwise flush() would cancel their pending save and
      // report success without persisting them
      if (stateRef.current === s) dirty.current = false
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

  // Unmounting with a pending edit (switching bottom-nav tabs mid-debounce)
  // must flush, not discard — the cleanup above this one clears the timer
  const saveNowRef = useRef(saveNow)
  saveNowRef.current = saveNow
  useEffect(() => () => {
    clearTimeout(timer.current)
    if (dirty.current) saveNowRef.current().catch(() => {})
  }, [])

  const act = useCallback((a: Action) => dispatch(a), [])
  return { state, status, act, flush }
}
