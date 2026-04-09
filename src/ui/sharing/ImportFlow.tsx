import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useSheetContext } from '../../data/useSheetContext'
import { fetchRoutineRows } from '../../sheets/sheetsApi'
import { appendRoutineRows, createExampleSheet } from '../../sheets/driveApi'
import type { RoutineRow } from '../../types'

type DuplicateAction = 'skip' | 'rename' | 'replace'

interface ImportFlowProps {
  sheetId: string
  onDone: () => void
}

export function ImportFlow({ sheetId, onDone }: ImportFlowProps) {
  const { user } = useAuth()
  const { spreadsheetId, setSpreadsheetId } = useSheetContext()
  const [routines, setRoutines] = useState<RoutineRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState('')
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set())
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)

  const programs = useMemo(() => {
    return [...new Set(routines.map((r) => r.program))].filter(Boolean)
  }, [routines])

  useEffect(() => {
    fetchRoutineRows(sheetId)
      .then((rows) => {
        setRoutines(rows)
        setSelectedPrograms(new Set(
          [...new Set(rows.map((r) => r.program))].filter(Boolean)
        ))
        setIsLoading(false)
      })
      .catch(() => {
        setError('Could not read the shared sheet. It may have been deleted or you may not have access.')
        setIsLoading(false)
      })
  }, [sheetId])

  const toggleProgram = (program: string) => {
    setSelectedPrograms((prev) => {
      const next = new Set(prev)
      if (next.has(program)) next.delete(program)
      else next.add(program)
      return next
    })
  }

  const handleImport = async (duplicateAction?: DuplicateAction) => {
    if (!user) return
    setIsImporting(true)
    setError('')

    let rowsToImport = routines.filter((r) => selectedPrograms.has(r.program))
    if (rowsToImport.length === 0) {
      setError('No programs selected')
      setIsImporting(false)
      return
    }

    try {
      let targetSheetId = spreadsheetId

      if (!targetSheetId) {
        // No personal sheet — create one with the imported rows
        targetSheetId = await createExampleSheet(rowsToImport)
        setSpreadsheetId(targetSheetId)
        onDone()
        return
      }

      // Check for duplicate programs in existing sheet
      if (!duplicateAction) {
        const existingRows = await fetchRoutineRows(targetSheetId)
        const existing = [...new Set(existingRows.map((r) => r.program))].filter(Boolean)
        const dupes = [...selectedPrograms].filter((p) => existing.includes(p))

        if (dupes.length > 0) {
          setDuplicates(dupes)
          setShowDuplicateWarning(true)
          setIsImporting(false)
          return
        }
      }

      // Handle duplicate action
      if (duplicateAction === 'skip') {
        rowsToImport = rowsToImport.filter((r) => !duplicates.includes(r.program))
        if (rowsToImport.length === 0) {
          onDone()
          return
        }
      } else if (duplicateAction === 'rename') {
        rowsToImport = rowsToImport.map((r) => {
          if (duplicates.includes(r.program)) {
            return { ...r, program: `${r.program} (imported)` }
          }
          return r
        })
      }
      // 'replace' — just append as-is (user accepts duplicates)

      await appendRoutineRows(targetSheetId, rowsToImport)
      onDone()
    } catch (e) {
      setError(String(e))
    }
    setIsImporting(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <p className="text-gray-400">Loading shared program...</p>
      </div>
    )
  }

  if (error && routines.length === 0) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center px-6">
        <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        <button onClick={onDone} className="text-[#6c63ff] text-sm font-semibold">Continue to App</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-6">
      <h1 className="text-2xl font-bold mb-1">Import Program</h1>
      <p className="text-gray-400 text-sm mb-6">
        {programs.length > 1
          ? 'Select which programs to import to your sheet'
          : 'Import this program to your sheet'}
      </p>

      {programs.map((p) => {
        const exerciseCount = routines.filter((r) => r.program === p).length
        const isSelected = selectedPrograms.has(p)
        return (
          <button key={p} onClick={() => programs.length > 1 && toggleProgram(p)}
            className={`w-full rounded-[10px] p-4 mb-2 text-left flex items-center gap-3 ${
              isSelected ? 'bg-[#6c63ff]/15 border border-[#6c63ff]' : 'bg-[#2a2a4a]'
            }`}>
            {programs.length > 1 && (
              <div className={`w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 ${
                isSelected ? 'bg-[#6c63ff]' : 'border-2 border-[#444]'
              }`}>
                {isSelected && '✓'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{p}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{exerciseCount} exercises</div>
            </div>
          </button>
        )
      })}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      {showDuplicateWarning ? (
        <div className="mt-4 bg-[#2a2a4a] rounded-[10px] p-4">
          <p className="text-sm font-semibold mb-1">Duplicate programs found</p>
          <p className="text-[11px] text-gray-400 mb-3">
            {duplicates.join(', ')} already {duplicates.length === 1 ? 'exists' : 'exist'} in your sheet.
          </p>
          <button onClick={() => { setShowDuplicateWarning(false); handleImport('skip') }}
            className="w-full bg-[#2a2a4a] border border-[#3a3a5a] rounded-[10px] p-3 text-center text-sm mb-2">
            Skip Duplicates
          </button>
          <button onClick={() => { setShowDuplicateWarning(false); handleImport('rename') }}
            className="w-full bg-[#2a2a4a] border border-[#3a3a5a] rounded-[10px] p-3 text-center text-sm mb-2">
            Import as "{duplicates[0]} (imported)"
          </button>
          <button onClick={() => { setShowDuplicateWarning(false); handleImport('replace') }}
            className="w-full bg-[#2a2a4a] border border-[#3a3a5a] rounded-[10px] p-3 text-center text-sm text-yellow-400 mb-2">
            Import Anyway (may cause duplicates)
          </button>
          <button onClick={onDone} className="w-full p-3 text-center text-gray-400 font-semibold text-sm">
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button onClick={() => handleImport()} disabled={isImporting || selectedPrograms.size === 0}
            className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm mt-4 disabled:opacity-50">
            {isImporting ? 'Importing...' : `Import ${selectedPrograms.size} Program${selectedPrograms.size !== 1 ? 's' : ''}`}
          </button>

          <button onClick={onDone} className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
            Skip
          </button>
        </>
      )}
    </div>
  )
}
