import { useState, useMemo } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useSheetContext } from '../../data/useSheetContext'
import { appendLogEntries } from '../../sheets/sheetsApi'
import { appendRoutineRows } from '../../sheets/driveApi'
import type { LogEntry, RoutineRow } from '../../types'

interface HevyRow {
  title: string
  startTime: string
  exerciseTitle: string
  setIndex: number
  weightLbs: number | null
  reps: number
  distanceMiles: number | null
  durationSeconds: number | null
}

function parseHevyCsv(text: string): HevyRow[] {
  const lines = text.split('\n')
  if (lines.length < 2) return []

  const rows: HevyRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse CSV with quoted fields
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '"') {
        inQuotes = !inQuotes
      } else if (line[j] === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += line[j]
      }
    }
    fields.push(current)

    if (fields.length < 11) continue

    rows.push({
      title: fields[0],
      startTime: fields[1],
      exerciseTitle: fields[4],
      setIndex: parseInt(fields[7]) || 0,
      weightLbs: fields[9] ? parseFloat(fields[9]) : null,
      reps: parseInt(fields[10]) || 0,
      distanceMiles: fields[11] ? parseFloat(fields[11]) : null,
      durationSeconds: fields[12] ? parseFloat(fields[12]) : null,
    })
  }
  return rows
}

function parseHevyDate(dateStr: string): string {
  // "7 Apr 2026, 05:12" → "2026-04-07"
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  }
  const parts = dateStr.trim().split(/[\s,]+/)
  if (parts.length < 3) return ''
  const day = parts[0].padStart(2, '0')
  const month = months[parts[1]] || '01'
  const year = parts[2]
  return `${year}-${month}-${day}`
}

function formatAthleteName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return parts[0] || ''
  return `${parts[0]} ${parts[parts.length - 1][0]}`
}

function reverseEngineerRoutines(rows: HevyRow[], programName: string): RoutineRow[] {
  // Group by routine title, take the most recent instance of each
  const routineLatest = new Map<string, HevyRow[]>()
  const routineDates = new Map<string, string>()

  for (const row of rows) {
    const date = parseHevyDate(row.startTime)
    const existing = routineDates.get(row.title)
    if (!existing || date > existing) {
      routineDates.set(row.title, date)
      routineLatest.set(row.title, [])
    }
    if (date === routineDates.get(row.title)) {
      routineLatest.get(row.title)!.push(row)
    }
  }

  const routineRows: RoutineRow[] = []
  for (const [routineName, exerciseRows] of routineLatest) {
    // Group by exercise, find max set count and most common reps/weight
    const exercises = new Map<string, { sets: number; reps: number; value: number | null }>()
    for (const row of exerciseRows) {
      const existing = exercises.get(row.exerciseTitle)
      if (!existing || row.setIndex + 1 > existing.sets) {
        exercises.set(row.exerciseTitle, {
          sets: row.setIndex + 1,
          reps: row.reps,
          value: row.weightLbs,
        })
      }
    }

    for (const [exerciseName, info] of exercises) {
      routineRows.push({
        program: programName,
        routine: routineName,
        exercise: exerciseName,
        sets: String(info.sets),
        reps: info.reps || null,
        value: info.value,
        unit: 'lbs',
        notes: '',
      })
    }
  }

  return routineRows
}

interface ImportHevyModalProps {
  onClose: () => void
  onDone: () => void
}

export function ImportHevyModal({ onClose, onDone }: ImportHevyModalProps) {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const [csvData, setCsvData] = useState<HevyRow[] | null>(null)
  const [programName, setProgramName] = useState('HEVY Import')
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  const stats = useMemo(() => {
    if (!csvData) return null
    const routines = new Set(csvData.map((r) => r.title))
    const exercises = new Set(csvData.map((r) => r.exerciseTitle))
    const dates = new Set(csvData.map((r) => parseHevyDate(r.startTime)))
    return { routines: routines.size, exercises: exercises.size, workouts: dates.size, sets: csvData.length }
  }, [csvData])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseHevyCsv(text)
      if (rows.length === 0) {
        setError('No data found in CSV')
        return
      }
      setCsvData(rows)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!csvData || !spreadsheetId || !user) return
    setIsImporting(true)
    setError('')

    try {
      const athleteName = formatAthleteName(user.name)

      // Convert to log entries
      const logEntries: LogEntry[] = csvData.map((row) => ({
        date: parseHevyDate(row.startTime),
        athlete: athleteName,
        program: programName,
        routine: row.title,
        exercise: row.exerciseTitle,
        set: row.setIndex + 1,
        reps: row.reps,
        value: row.weightLbs,
        unit: 'lbs',
        notes: '',
      }))

      // Reverse engineer routines
      const routineRows = reverseEngineerRoutines(csvData, programName)

      // Write to sheet
      await appendRoutineRows(spreadsheetId, routineRows)
      await appendLogEntries(spreadsheetId, logEntries)

      setStep('done')
    } catch (e) {
      console.error('Import failed:', e)
      setError(String(e))
    }
    setIsImporting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {step === 'upload' && (
          <>
            <h2 className="text-base font-bold text-center mb-2">Import from HEVY</h2>
            <p className="text-xs text-gray-400 text-center mb-4">
              Export your data from HEVY (Settings → Export Data) and select the CSV file
            </p>
            <label className="block w-full border-2 border-dashed border-[#6c63ff] rounded-[10px] p-6 text-center cursor-pointer active:opacity-80">
              <span className="text-sm text-[#6c63ff] font-semibold">Select CSV File</span>
              <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
            </label>
            {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}
            <button onClick={onClose} className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-2">
              Cancel
            </button>
          </>
        )}

        {step === 'preview' && stats && (
          <>
            <h2 className="text-base font-bold text-center mb-2">Preview Import</h2>
            <div className="bg-[#2a2a4a] rounded-[10px] p-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Workouts</span>
                <span className="text-white font-semibold">{stats.workouts}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Routines</span>
                <span className="text-white font-semibold">{stats.routines}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Exercises</span>
                <span className="text-white font-semibold">{stats.exercises}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Total Sets</span>
                <span className="text-white font-semibold">{stats.sets}</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-2">Program name</p>
            <input type="text" value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              className="w-full bg-[#2a2a4a] border border-[#3a3a5a] rounded-[10px] px-4 py-3 text-base outline-none focus:border-[#6c63ff] mb-4" />

            {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}

            <button onClick={handleImport} disabled={isImporting || !programName.trim()}
              className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm disabled:opacity-50">
              {isImporting ? 'Importing...' : 'Import'}
            </button>
            <button onClick={() => { setStep('upload'); setCsvData(null) }}
              className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
              Back
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <h2 className="text-base font-bold text-center mb-2">Import Complete!</h2>
            <p className="text-xs text-gray-400 text-center mb-4">
              {stats?.sets} sets imported across {stats?.routines} routines. Routines have been reverse-engineered from your workout history.
            </p>
            <button onClick={() => { onDone(); onClose() }}
              className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm">
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
