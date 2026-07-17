import type { RoutineRow, LogEntry } from '../types'
import { authFetch } from '../auth/authFetch'
import { GOOGLE_API_KEY } from '../config'
import { parseRoutineValue, parseReps } from './routineSerialization'
import { parseAchieved } from '../workout/achievedRpe'

/**
 * Converts a Google Sheets serial date number to YYYY-MM-DD.
 * With UNFORMATTED_VALUE, date cells always come back as serial numbers
 * regardless of the spreadsheet's locale or cell format.
 * 25569 = days between the Sheets epoch (Dec 30 1899) and Unix epoch.
 */
function normalizeDate(raw: string): string {
  if (!raw) return raw
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  // Accept datetime serials too (e.g. 45123.75 from NOW()) — the fraction
  // is the time of day; the whole part is the date
  const serial = Number(raw)
  if (Number.isFinite(serial) && serial > 1) {
    const date = new Date(Math.round((Math.floor(serial) - 25569) * 86400000))
    return date.toISOString().split('T')[0]
  }

  return raw
}

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

async function fetchRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`
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
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${GOOGLE_API_KEY}&valueRenderOption=UNFORMATTED_VALUE`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Sheets API error: ${err.error?.message ?? res.statusText}`)
  }
  const data = await res.json()
  return data.values ?? []
}

/**
 * Percentages must be explicit ("75%", "TM", "1RM") — bare decimals are real
 * weights/distances, and values keep their decimals so 62.5 survives.
 * Load parsing (pct/RPE/RIR/basis) and rep ranges live in routineSerialization.
 */
export function mapRoutineRow(row: string[]): RoutineRow {
  const parsed = parseRoutineValue(row[5])
  const pr = parseReps(row[4])
  return {
    program: row[0] ?? '',
    routine: row[1] ?? '',
    exercise: row[2] ?? '',
    sets: String(row[3] ?? '1'),
    reps: pr.reps,
    ...(pr.repsMax !== undefined ? { repsMax: pr.repsMax } : {}),
    ...(pr.repsOpen ? { repsOpen: true } : {}),
    value: parsed.value,
    pct: parsed.pct,
    basis: parsed.basis ?? undefined,
    ...(parsed.rpe !== undefined ? { rpe: parsed.rpe } : {}),
    ...(parsed.rir !== undefined ? { rir: parsed.rir } : {}),
    unit: row[6] ?? '',
    notes: row[7] ?? '',
  }
}

/** Fetch routines from a publicly shared sheet (for import flow) */
export async function fetchPublicRoutineRows(spreadsheetId: string): Promise<RoutineRow[]> {
  const rows = await fetchPublicRange(spreadsheetId, 'Routines!A:H')
  if (rows.length < 2) return []
  return rows.slice(1).map(mapRoutineRow)
}

export async function fetchRoutineRows(spreadsheetId: string): Promise<RoutineRow[]> {
  const rows = await fetchRange(spreadsheetId, 'Routines!A:H')
  if (rows.length < 2) return []
  return rows.slice(1).map(mapRoutineRow)
}

export async function fetchLogEntries(spreadsheetId: string): Promise<LogEntry[]> {
  const rows = await fetchRange(spreadsheetId, 'Log!A:K')
  if (rows.length < 2) return []
  return rows.slice(1).map(parseLogRow)
}

export interface IndexedLogEntry extends LogEntry {
  rowIndex: number  // 1-based sheet row (header = row 1, first data row = row 2)
}

function parseLogRow(row: string[]): LogEntry {
  const { notes, rpe, rir } = parseAchieved(row[9] ?? '')
  return {
    date: normalizeDate(row[0] ?? ''),
    athlete: row[1] ?? '',
    program: row[2] ?? '',
    routine: row[3] ?? '',
    exercise: row[4] ?? '',
    set: row[5] ? Number(row[5]) : 0,
    reps: row[6] ? Number(row[6]) : 0,
    value: row[7] ? Number(row[7]) : null,
    unit: row[8] ?? '',
    notes,
    pct: row[10] ? Number(row[10]) : null,
    achievedRpe: rpe,
    achievedRir: rir,
  }
}

export async function fetchLogEntriesWithRows(spreadsheetId: string): Promise<IndexedLogEntry[]> {
  const rows = await fetchRange(spreadsheetId, 'Log!A:K')
  if (rows.length < 2) return []
  return rows.slice(1).map((row, i) => ({ ...parseLogRow(row), rowIndex: i + 2 }))
}

export async function updateLogRows(
  spreadsheetId: string,
  updates: Array<{ rowIndex: number; entry: LogEntry }>
): Promise<void> {
  if (updates.length === 0) return
  const url = `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: updates.map(({ rowIndex, entry }) => ({
        range: `Log!A${rowIndex}:K${rowIndex}`,
        values: [[
          entry.date, entry.athlete, entry.program, entry.routine, entry.exercise,
          entry.set, entry.reps, entry.value ?? '', entry.unit, entry.notes, entry.pct ?? '',
        ]],
      })),
    }),
  })
  if (!res.ok) throw new Error('Failed to batch update log rows')
}

/**
 * Physically deletes Log rows (1-based sheet indexes). Deletes bottom-up so
 * earlier deletions don't shift the indexes of later ones.
 */
export async function deleteLogRows(spreadsheetId: string, rowIndexes: number[]): Promise<void> {
  if (rowIndexes.length === 0) return

  const metaRes = await authFetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`)
  if (!metaRes.ok) throw new Error('Failed to load spreadsheet metadata')
  const meta = await metaRes.json()
  const logSheet = (meta.sheets ?? []).find(
    (s: { properties?: { title?: string; sheetId?: number } }) => s.properties?.title === 'Log'
  )
  if (logSheet?.properties?.sheetId == null) throw new Error('Log tab not found')
  const gid = logSheet.properties.sheetId

  const requests = [...new Set(rowIndexes)].sort((a, b) => b - a).map((rowIndex) => ({
    deleteDimension: {
      range: { sheetId: gid, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
    },
  }))
  const res = await authFetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
  if (!res.ok) throw new Error('Failed to delete log rows')
}

export interface RoutineSetCountUpdate {
  program: string
  routine: string
  exercise: string
  sets: number
}

/**
 * Writes new set counts to the Routines tab for exercises the user added sets to.
 * Only updates exercises that map to exactly one Routines row — multi-row
 * exercises (per-set percentage schemes) have no single "sets" cell to change.
 * Returns how many rows were updated.
 */
export async function updateRoutineSetCounts(
  spreadsheetId: string,
  updates: RoutineSetCountUpdate[]
): Promise<number> {
  if (updates.length === 0) return 0
  const rows = await fetchRange(spreadsheetId, 'Routines!A:H')

  const data: Array<{ range: string; values: string[][] }> = []
  for (const u of updates) {
    const matches: number[] = []
    rows.forEach((row, i) => {
      if (i === 0) return
      if (
        String(row[0] ?? '') === u.program &&
        String(row[1] ?? '') === u.routine &&
        String(row[2] ?? '') === u.exercise
      ) matches.push(i)
    })
    if (matches.length !== 1) continue
    const current = String(rows[matches[0]][3] ?? '').trim()
    // Preserve a superset suffix letter, e.g. "3a" -> "5a"
    const suffix = current.match(/^\d+([a-zA-Z])$/)?.[1] ?? ''
    data.push({ range: `Routines!D${matches[0] + 1}`, values: [[`${u.sets}${suffix}`]] })
  }
  if (data.length === 0) return 0

  const url = `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
  })
  if (!res.ok) throw new Error('Failed to update routine set counts')
  return data.length
}

export async function appendLogEntries(spreadsheetId: string, entries: LogEntry[]): Promise<void> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/Log!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const values = entries.map((e) => [
    e.date, e.athlete, e.program, e.routine, e.exercise,
    e.set, e.reps, e.value ?? '', e.unit, e.notes,
    e.pct ?? '',
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
