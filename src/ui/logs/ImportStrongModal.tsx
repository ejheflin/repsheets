import { useState, useMemo } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useSheetContext } from '../../data/useSheetContext'
import { appendLogEntries } from '../../sheets/sheetsApi'
import { appendRoutineRows } from '../../sheets/driveApi'
import type { LogEntry, RoutineRow } from '../../types'

interface StrongRow {
  date: string
  workoutName: string
  exerciseName: string
  setOrder: number
  weight: number | null
  reps: number
}

function parseStrongCsv(text: string): StrongRow[] {
  const lines = text.split('\n')
  if (lines.length < 2) return []

  const rows: StrongRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

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

    if (fields.length < 7) continue

    // Date is "2020-04-07 22:38:33" → "2020-04-07"
    const datePart = fields[0].split(' ')[0]

    rows.push({
      date: datePart,
      workoutName: fields[1],
      exerciseName: fields[3],
      setOrder: parseInt(fields[4]) || 1,
      weight: fields[5] ? parseFloat(fields[5]) : null,
      reps: Math.round(parseFloat(fields[6]) || 0),
    })
  }
  return rows
}

function formatAthleteName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return parts[0] || ''
  return `${parts[0]} ${parts[parts.length - 1][0]}`
}

function reverseEngineerRoutines(rows: StrongRow[], programName: string): RoutineRow[] {
  const routineLatest = new Map<string, StrongRow[]>()
  const routineDates = new Map<string, string>()

  for (const row of rows) {
    const existing = routineDates.get(row.workoutName)
    if (!existing || row.date > existing) {
      routineDates.set(row.workoutName, row.date)
      routineLatest.set(row.workoutName, [])
    }
    if (row.date === routineDates.get(row.workoutName)) {
      routineLatest.get(row.workoutName)!.push(row)
    }
  }

  const routineRows: RoutineRow[] = []
  for (const [routineName, exerciseRows] of routineLatest) {
    const exercises = new Map<string, { sets: number; reps: number; value: number | null }>()
    for (const row of exerciseRows) {
      const existing = exercises.get(row.exerciseName)
      if (!existing || row.setOrder > existing.sets) {
        exercises.set(row.exerciseName, {
          sets: row.setOrder,
          reps: row.reps,
          value: row.weight,
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

interface ImportStrongModalProps {
  onClose: () => void
  onDone: () => void
}

export function ImportStrongModal({ onClose, onDone }: ImportStrongModalProps) {
  const { user } = useAuth()
  const { spreadsheetId } = useSheetContext()
  const [csvData, setCsvData] = useState<StrongRow[] | null>(null)
  const [programName, setProgramName] = useState('Strong Import')
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  const stats = useMemo(() => {
    if (!csvData) return null
    const routines = new Set(csvData.map((r) => r.workoutName))
    const exercises = new Set(csvData.map((r) => r.exerciseName))
    const dates = new Set(csvData.map((r) => r.date))
    return { routines: routines.size, exercises: exercises.size, workouts: dates.size, sets: csvData.length }
  }, [csvData])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseStrongCsv(text)
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

      const logEntries: LogEntry[] = csvData.map((row) => ({
        date: row.date,
        athlete: athleteName,
        program: programName,
        routine: row.workoutName,
        exercise: row.exerciseName,
        set: row.setOrder,
        reps: row.reps,
        value: row.weight,
        unit: 'lbs',
        notes: '',
      }))

      const routineRows = reverseEngineerRoutines(csvData, programName)

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
            <h2 className="text-base font-bold text-center mb-2">Import from Strong</h2>
            <p className="text-xs text-gray-400 text-center mb-4">
              Export your data from Strong (Settings → Export Workout Data) and select the CSV file
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
