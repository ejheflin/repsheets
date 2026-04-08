import { useState, useEffect } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from '../data/useSheetContext'
import { listRepSheets, createExampleSheet } from '../sheets/driveApi'
import type { RepSheet, RoutineRow } from '../types'

const PLACEHOLDER_ROWS: RoutineRow[] = [
  { program: 'Starter', routine: 'Day1:FullBody', exercise: 'Squat', sets: '3', reps: 5, value: null, unit: 'lbs', notes: '' },
  { program: 'Starter', routine: 'Day1:FullBody', exercise: 'Bench Press', sets: '3', reps: 5, value: null, unit: 'lbs', notes: '' },
  { program: 'Starter', routine: 'Day1:FullBody', exercise: 'Barbell Row', sets: '3', reps: 5, value: null, unit: 'lbs', notes: '' },
]

export function SheetSelector() {
  const { user } = useAuth()
  const { setSpreadsheetId } = useSheetContext()
  const [sheets, setSheets] = useState<RepSheet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!user) return
    listRepSheets().then((s) => {
      setSheets(s)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [user])

  const handleCreate = async () => {
    if (!user) return
    setIsCreating(true)
    try {
      const id = await createExampleSheet(PLACEHOLDER_ROWS)
      setSpreadsheetId(id)
    } catch (e) {
      console.error('Failed to create sheet:', e)
    }
    setIsCreating(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <p className="text-gray-400">Scanning for repsheets...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-6">
      <h1 className="text-2xl font-bold mb-1">Select a Sheet</h1>
      <p className="text-gray-400 text-sm mb-6">Pick an existing repsheets spreadsheet or create a new one.</p>
      {sheets.map((s) => (
        <button key={s.spreadsheetId} onClick={() => setSpreadsheetId(s.spreadsheetId)}
          className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
          <div className="font-semibold">{s.name}</div>
          <div className="text-xs text-gray-500 mt-1">Owner: {s.owner}</div>
        </button>
      ))}
      <button onClick={handleCreate} disabled={isCreating}
        className="w-full border-2 border-dashed border-[#6c63ff] rounded-[10px] p-4 mt-2 text-center text-[#6c63ff] font-semibold">
        {isCreating ? 'Creating...' : '+ Create Example Sheet'}
      </button>
    </div>
  )
}
