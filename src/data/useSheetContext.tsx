import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getPreference, setPreference } from './db'

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
    getPreference('activeSheet').then((id) => {
      if (id) setId(id)
      setLoaded(true)
    })
  }, [])

  const setSpreadsheetId = (id: string) => {
    setId(id)
    setPreference('activeSheet', id)
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
