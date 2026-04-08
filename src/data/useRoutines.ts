import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from './useSheetContext'
import { fetchRoutineRows } from '../sheets/sheetsApi'
import { saveRoutines, getRoutines } from './db'
import type { RoutineRow } from '../types'

export function useRoutines(selectedProgram: string | null) {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const [allRows, setAllRows] = useState<RoutineRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!spreadsheetId || !user) return
    setIsLoading(true)
    try {
      const rows = await fetchRoutineRows(spreadsheetId, user.accessToken)
      await saveRoutines(spreadsheetId, rows)
      setAllRows(rows)
    } catch {
      const cached = await getRoutines(spreadsheetId)
      setAllRows(cached)
    }
    setIsLoading(false)
  }, [spreadsheetId, user])

  useEffect(() => {
    const load = async () => {
      if (!spreadsheetId) {
        setIsLoading(false)
        return
      }
      const cached = await getRoutines(spreadsheetId)
      if (cached.length > 0) {
        setAllRows(cached)
        setIsLoading(false)
      }
      if (user) {
        refresh()
      }
    }
    load()
  }, [spreadsheetId, user, refresh])

  const programs = [...new Set(allRows.map((r) => r.program))].filter(Boolean)

  const routines = selectedProgram
    ? allRows.filter((r) => r.program === selectedProgram)
    : allRows

  const routineNames = [...new Set(routines.map((r) => r.routine))]

  const routineList = routineNames.map((name) => {
    const rows = routines.filter((r) => r.routine === name)
    const exercises = [...new Set(rows.map((r) => r.exercise))]
    return { name, exercises, rows }
  })

  return { routineList, programs, allRows, isLoading, refresh }
}
