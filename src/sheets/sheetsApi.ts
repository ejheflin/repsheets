import type { RoutineRow, LogEntry } from '../types'
import { authFetch } from '../auth/authFetch'
import { GOOGLE_API_KEY } from '../config'

/**
 * Converts a Google Sheets serial date number to YYYY-MM-DD.
 * With UNFORMATTED_VALUE, date cells always come back as serial numbers
 * regardless of the spreadsheet's locale or cell format.
 * 25569 = days between the Sheets epoch (Dec 30 1899) and Unix epoch.
 */
function normalizeDate(raw: string): string {
  if (!raw) return raw
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const serial = Number(raw)
  if (Number.isInteger(serial) && serial > 1) {
    const date = new Date(Math.round((serial - 25569) * 86400000))
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

/** Fetch routines from a publicly shared sheet (for import flow) */
export async function fetchPublicRoutineRows(spreadsheetId: string): Promise<RoutineRow[]> {
  const rows = await fetchPublicRange(spreadsheetId, 'Routines!A:H')
  if (rows.length < 2) return []
  return rows.slice(1).map((row) => {
    const rawValue = String(row[5] ?? '')
    const num = rawValue ? parseFloat(rawValue) : NaN
    const isDecimalPct = !isNaN(num) && num > 0 && num < 1 && !rawValue.endsWith('%')
    const isPct = rawValue.endsWith('%') || isDecimalPct
    const rawPct = isPct
      ? (rawValue.endsWith('%') ? parseFloat(rawValue) || null : num * 100)
      : null
    const pct: number | null = rawPct != null ? Math.round(rawPct) : null
    return {
      program: row[0] ?? '',
      routine: row[1] ?? '',
      exercise: row[2] ?? '',
      sets: String(row[3] ?? '1'),
      reps: row[4] ? Number(row[4]) : null,
      value: isPct ? null : (rawValue ? Math.round(Number(rawValue)) : null),
      pct,
      unit: row[6] ?? '',
      notes: row[7] ?? '',
    }
  })
}

export async function fetchRoutineRows(spreadsheetId: string): Promise<RoutineRow[]> {
  const rows = await fetchRange(spreadsheetId, 'Routines!A:H')
  if (rows.length < 2) return []
  return rows.slice(1).map((row) => {
    const rawValue = String(row[5] ?? '')
    const num = rawValue ? parseFloat(rawValue) : NaN
    const isDecimalPct = !isNaN(num) && num > 0 && num < 1 && !rawValue.endsWith('%')
    const isPct = rawValue.endsWith('%') || isDecimalPct
    const rawPct = isPct
      ? (rawValue.endsWith('%') ? parseFloat(rawValue) || null : num * 100)
      : null
    const pct: number | null = rawPct != null ? Math.round(rawPct) : null
    return {
      program: row[0] ?? '',
      routine: row[1] ?? '',
      exercise: row[2] ?? '',
      sets: String(row[3] ?? '1'),
      reps: row[4] ? Number(row[4]) : null,
      value: isPct ? null : (rawValue ? Math.round(Number(rawValue)) : null),
      pct,
      unit: row[6] ?? '',
      notes: row[7] ?? '',
    }
  })
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
    notes: row[9] ?? '',
    pct: row[10] ? Number(row[10]) : null,
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
