import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from '../data/useSheetContext'
import { listRepSheets, createExampleSheet } from '../sheets/driveApi'
import { fetchPublicRoutineRows } from '../sheets/sheetsApi'
import { TEMPLATE_SHEET_ID } from '../config'
import type { RepSheet, RoutineRow } from '../types'

type View = 'select' | 'create'

export function SheetSelector() {
  const { user } = useAuth()
  const { setSpreadsheetId } = useSheetContext()
  const [sheets, setSheets] = useState<RepSheet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [view, setView] = useState<View>('select')

  // Template data
  const [templateRows, setTemplateRows] = useState<RoutineRow[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!user) return
    listRepSheets().then((s) => {
      setSheets(s)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [user])

  const programs = useMemo(() => {
    return [...new Set(templateRows.map((r) => r.program))].filter(Boolean)
  }, [templateRows])

  const loadTemplate = async () => {
    setView('create')
    setTemplateLoading(true)
    setError('')
    try {
      const rows = await fetchPublicRoutineRows(TEMPLATE_SHEET_ID)
      setTemplateRows(rows)
      // Select first program by default
      const progs = [...new Set(rows.map((r) => r.program))].filter(Boolean)
      if (progs.length > 0) setSelectedPrograms(new Set([progs[0]]))
    } catch (e) {
      console.error('Failed to load templates:', e)
      setError('Failed to load program templates')
    }
    setTemplateLoading(false)
  }

  const toggleProgram = (program: string) => {
    setSelectedPrograms((prev) => {
      const next = new Set(prev)
      if (next.has(program)) next.delete(program)
      else next.add(program)
      return next
    })
  }

  const handleCreate = async () => {
    if (!user) return
    setIsCreating(true)
    setError('')
    try {
      const rowsToInclude = templateRows.filter((r) => selectedPrograms.has(r.program))
      const id = await createExampleSheet(rowsToInclude)
      setSpreadsheetId(id)
    } catch (e) {
      console.error('Failed to create sheet:', e)
      setError(String(e))
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

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-[#1a1a2e] text-white p-6">
        <h1 className="text-2xl font-bold mb-1">Create Your Sheet</h1>
        <p className="text-gray-400 text-sm mb-6">Select programs to include in your workout sheet</p>

        {templateLoading ? (
          <p className="text-gray-400 text-center py-8">Loading programs...</p>
        ) : (
          <>
            {programs.map((p) => {
              const exerciseCount = new Set(templateRows.filter((r) => r.program === p).map((r) => r.exercise)).size
              const routineCount = new Set(templateRows.filter((r) => r.program === p).map((r) => r.routine)).size
              const isSelected = selectedPrograms.has(p)
              return (
                <button key={p} onClick={() => toggleProgram(p)}
                  className={`w-full rounded-[10px] p-4 mb-2 text-left flex items-center gap-3 ${
                    isSelected ? 'bg-[#6c63ff]/15 border border-[#6c63ff]' : 'bg-[#2a2a4a]'
                  }`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 ${
                    isSelected ? 'bg-[#6c63ff]' : 'border-2 border-[#444]'
                  }`}>
                    {isSelected && '✓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{p}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{routineCount} routines, {exerciseCount} exercises</div>
                  </div>
                </button>
              )
            })}

            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

            <button onClick={handleCreate} disabled={isCreating || selectedPrograms.size === 0}
              className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm mt-4 disabled:opacity-50">
              {isCreating ? 'Creating...' : `Create Sheet with ${selectedPrograms.size} Program${selectedPrograms.size !== 1 ? 's' : ''}`}
            </button>

            <button onClick={() => setView('select')}
              className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
              Back
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-6">
      <h1 className="text-2xl font-bold mb-1">Welcome to repsheets</h1>
      <p className="text-gray-400 text-sm mb-6">
        {sheets.length > 0
          ? 'Select an existing sheet or create a new one'
          : 'Get started by creating your first workout sheet'}
      </p>

      {sheets.map((s) => (
        <button key={s.spreadsheetId} onClick={() => setSpreadsheetId(s.spreadsheetId)}
          className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
          <div className="font-semibold">{s.name}</div>
          <div className="text-xs text-gray-500 mt-1">Owner: {s.owner}</div>
        </button>
      ))}

      <button onClick={loadTemplate}
        className="w-full border-2 border-dashed border-[#6c63ff] rounded-[10px] p-4 mt-2 text-center text-[#6c63ff] font-semibold">
        + Create New Sheet
      </button>

    </div>
  )
}
