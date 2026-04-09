import type { RoutineRow, LogEntry } from '../types'
import { authFetch } from '../auth/authFetch'
import { GOOGLE_API_KEY } from '../config'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

async function fetchRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`
  const res = await authFetch(url)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Sheets API error: ${err.error?.message ?? res.statusText}`)
  }
  const data = await res.json()
  return data.values ?? []
}

/** Fetch range from a publicly shared sheet (no auth, uses API key) */
async function fetchPublicRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${GOOGLE_API_KEY}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Sheets API error: ${err.error?.message ?? res.statusText}`)
  }
  const data = await res.json()
  return data.values ?? []
}

/** Fetch routines from a publicly shared sheet (for import flow) */
export async function fetchPublicRoutineRows(spreadsheetId: string): Promise<RoutineRow[]> {
  const rows = await fetchPublicRange(spreadsheetId, 'Routines!A:H')
  if (rows.length < 2) return []
  return rows.slice(1).map((row) => ({
    program: row[0] ?? '',
    routine: row[1] ?? '',
    exercise: row[2] ?? '',
    sets: row[3] ?? '1',
    reps: row[4] ? Number(row[4]) : null,
    value: row[5] ? Number(row[5]) : null,
    unit: row[6] ?? '',
    notes: row[7] ?? '',
  }))
}

export async function fetchRoutineRows(spreadsheetId: string): Promise<RoutineRow[]> {
  const rows = await fetchRange(spreadsheetId, 'Routines!A:H')
  if (rows.length < 2) return []
  return rows.slice(1).map((row) => ({
    program: row[0] ?? '',
    routine: row[1] ?? '',
    exercise: row[2] ?? '',
    sets: row[3] ?? '1',
    reps: row[4] ? Number(row[4]) : null,
    value: row[5] ? Number(row[5]) : null,
    unit: row[6] ?? '',
    notes: row[7] ?? '',
  }))
}

export async function fetchLogEntries(spreadsheetId: string): Promise<LogEntry[]> {
  const rows = await fetchRange(spreadsheetId, 'Log!A:J')
  if (rows.length < 2) return []
  return rows.slice(1).map((row) => ({
    date: row[0] ?? '',
    athlete: row[1] ?? '',
    program: row[2] ?? '',
    routine: row[3] ?? '',
    exercise: row[4] ?? '',
    set: row[5] ? Number(row[5]) : 0,
    reps: row[6] ? Number(row[6]) : 0,
    value: row[7] ? Number(row[7]) : null,
    unit: row[8] ?? '',
    notes: row[9] ?? '',
  }))
}

export async function appendLogEntries(spreadsheetId: string, entries: LogEntry[]): Promise<void> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/Log!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const values = entries.map((e) => [
    e.date, e.athlete, e.program, e.routine, e.exercise,
    e.set, e.reps, e.value ?? '', e.unit, e.notes,
  ])
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Sheets API append error: ${err.error?.message ?? res.statusText}`)
  }
}
