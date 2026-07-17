import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getPreference, setPreference } from './db'
import { isGhostActive } from '../demo/ghostMode'

interface SheetContextValue {
  spreadsheetId: string | null
  setSpreadsheetId: (id: string) => void
}

const SheetContext = createContext<SheetContextValue>({
  spreadsheetId: null,
  setSpreadsheetId: () => {},
})

export function SheetProvider({ children }: { children: ReactNode }) {
  const [spreadsheetId, setId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (isGhostActive()) {
      setLoaded(true)
      return
    }
    getPreference('activeSheet').then((id) => {
      if (id) setId(id)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const setSpreadsheetId = (id: string) => {
    setId(id)
    if (!isGhostActive()) setPreference('activeSheet', id)
  }

  if (!loaded) return null

  return (
    <SheetContext.Provider value={{ spreadsheetId, setSpreadsheetId }}>
      {children}
    </SheetContext.Provider>
  )
}

export function useSheetContext() {
  return useContext(SheetContext)
}
