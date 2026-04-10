import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from './useSheetContext'
import { fetchRoutineRows } from '../sheets/sheetsApi'
import { saveRoutines, getRoutines } from './db'
import { AuthExpiredError } from '../auth/authFetch'
import type { RoutineRow } from '../types'

const REFRESH_TIMEOUT_MS = 5000

export function useRoutines(selectedProgram: string | null) {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const [allRows, setAllRows] = useState<RoutineRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!spreadsheetId || !user) return

    // Race the API call against a timeout
    try {
      const rows = await Promise.race([
        fetchRoutineRows(spreadsheetId),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), REFRESH_TIMEOUT_MS)
        ),
      ])
      if (rows) {
        await saveRoutines(spreadsheetId, rows)
        setAllRows(rows)
      }
    } catch (e) {
      // Let auth errors propagate to trigger re-auth
      if (e instanceof AuthExpiredError) throw e
      // Timeout or other error — fall back to cache
      const cached = await getRoutines(spreadsheetId)
      if (cached.length > 0) {
        setAllRows(cached)
      }
    }
    setIsLoading(false)
  }, [spreadsheetId, user])

  useEffect(() => {
    const load = async () => {
      if (!spreadsheetId) {
        setIsLoading(false)
        return
      }
      // Show cache immediately
      const cached = await getRoutines(spreadsheetId)
      if (cached.length > 0) {
        setAllRows(cached)
        setIsLoading(false)
      }
      // Then refresh from API in background
      if (user) {
        refresh().catch(() => {}) // silently fall back to cache on mount
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
