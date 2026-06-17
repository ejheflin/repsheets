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
) {
  const [state, dispatch] = useReducer(reduce, initial)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const saved = await saveRoutineRows(spreadsheetId, state.program, state.routine, toRows(state))
        onSaved(saved)
        setStatus('saved')
      } catch {
        setStatus('error')
      }
    }, 600)
    return () => clearTimeout(timer.current)
  }, [state, spreadsheetId, onSaved])

  const act = useCallback((a: Action) => dispatch(a), [])
  return { state, status, act }
}
