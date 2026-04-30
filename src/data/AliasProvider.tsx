import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { readAlias, writeAlias } from '../sheets/driveApi'
import { fetchLogEntriesWithRows, updateLogRows } from '../sheets/sheetsApi'
import { useSheetContext } from './useSheetContext'

interface AliasContextValue {
  alias: string | null
  isLoadingAlias: boolean
  saveAlias: (newAlias: string, currentName: string) => Promise<void>
}

const AliasContext = createContext<AliasContextValue | null>(null)

export function AliasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const [alias, setAlias] = useState<string | null>(null)
  const [isLoadingAlias, setIsLoadingAlias] = useState(true)

  useEffect(() => {
    if (!user) { setIsLoadingAlias(false); return }
    readAlias().then((a) => { setAlias(a); setIsLoadingAlias(false) }).catch(() => setIsLoadingAlias(false))
  }, [user])

  const saveAlias = useCallback(async (newAlias: string, currentName: string) => {
    await writeAlias(newAlias)
    setAlias(newAlias)

    if (!spreadsheetId) return
    const entries = await fetchLogEntriesWithRows(spreadsheetId)
    const toUpdate = entries.filter((e) => e.athlete === currentName)
    if (toUpdate.length === 0) return

    await updateLogRows(spreadsheetId, toUpdate.map((e) => ({
      rowIndex: e.rowIndex,
      entry: { ...e, athlete: newAlias },
    })))
  }, [spreadsheetId])

  return (
    <AliasContext.Provider value={{ alias, isLoadingAlias, saveAlias }}>
      {children}
    </AliasContext.Provider>
  )
}

export function useAlias() {
  const ctx = useContext(AliasContext)
  if (!ctx) throw new Error('useAlias must be used within AliasProvider')
  return ctx
}
