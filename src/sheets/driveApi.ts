import type { RepSheet, RoutineRow } from '../types'
import { authFetch } from '../auth/authFetch'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export async function listRepSheets(): Promise<RepSheet[]> {
  const query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  const url = `${DRIVE_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,owners)&pageSize=100`
  const res = await authFetch(url)
  if (!res.ok) throw new Error('Failed to list sheets')
  const data = await res.json()
  const sheets: RepSheet[] = []
  for (const file of data.files ?? []) {
    const hasSchema = await checkRepSheetsSchema(file.id)
    if (hasSchema) {
      sheets.push({
        spreadsheetId: file.id,
        name: file.name,
        owner: file.owners?.[0]?.displayName ?? 'Unknown',
        ownerEmail: file.owners?.[0]?.emailAddress ?? '',
      })
    }
  }
  return sheets
}

async function checkRepSheetsSchema(spreadsheetId: string): Promise<boolean> {
  try {
    const url = `${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties.title`
    const res = await authFetch(url)
    if (!res.ok) return false
    const data = await res.json()
    const titles = (data.sheets ?? []).map(
      (s: { properties: { title: string } }) => s.properties.title
    )
    return titles.includes('Routines') && titles.includes('Log')
  } catch { return false }
}

const ROUTINE_HEADERS = ['Program', 'Routine', 'Exercise', 'Sets', 'Reps', 'Value', 'Unit', 'Notes']
const LOG_HEADERS = ['Date', 'Athlete', 'Program', 'Routine', 'Exercise', 'Set', 'Reps', 'Value', 'Unit', 'Notes']

export async function createExampleSheet(programRows: RoutineRow[]): Promise<string> {
  const createRes = await authFetch(SHEETS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: 'repsheets - My Workouts' },
      sheets: [
        { properties: { title: 'Routines' } },
        { properties: { title: 'Log' } },
      ],
    }),
  })
  if (!createRes.ok) throw new Error('Failed to create spreadsheet')
  const created = await createRes.json()
  const spreadsheetId = created.spreadsheetId

  const routineValues = [
    ROUTINE_HEADERS,
    ...programRows.map((r) => [
      r.program, r.routine, r.exercise, r.sets,
      r.reps ?? '', r.value ?? '', r.unit, r.notes,
    ]),
  ]
  await writeRange(spreadsheetId, 'Routines!A1', routineValues)
  await writeRange(spreadsheetId, 'Log!A1', [LOG_HEADERS])
  return spreadsheetId
}

async function writeRange(spreadsheetId: string, range: string, values: (string | number)[][]): Promise<void> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
  const res = await authFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) throw new Error(`Failed to write range ${range}`)
}
