import type { RepSheet, RoutineRow } from '../types'
import { authFetch } from '../auth/authFetch'
import { getStoredUser } from '../auth/googleAuth'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

interface SheetSchemaInfo {
  hasSchema: boolean
  isTemplate: boolean
}

export async function listRepSheets(): Promise<RepSheet[]> {
  const query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  const url = `${DRIVE_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,owners)&pageSize=100`
  const res = await authFetch(url)
  if (!res.ok) throw new Error('Failed to list sheets')
  const data = await res.json()
  const currentUser = getStoredUser()
  const sheets: RepSheet[] = []
  for (const file of data.files ?? []) {
    const info = await checkRepSheetsSchema(file.id)
    if (info.hasSchema) {
      const ownerEmail = file.owners?.[0]?.emailAddress ?? ''
      const isOwner = currentUser?.email === ownerEmail
      // Hide owned shared templates from the switcher
      if (isOwner && info.isTemplate) continue
      sheets.push({
        spreadsheetId: file.id,
        name: file.name,
        owner: file.owners?.[0]?.displayName ?? 'Unknown',
        ownerEmail,
        isOwner,
        isTemplate: info.isTemplate,
      })
    }
  }
  return sheets
}

async function checkRepSheetsSchema(spreadsheetId: string): Promise<SheetSchemaInfo> {
  try {
    const url = `${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties.title`
    const res = await authFetch(url)
    if (!res.ok) return { hasSchema: false, isTemplate: false }
    const data = await res.json()
    const titles = (data.sheets ?? []).map(
      (s: { properties: { title: string } }) => s.properties.title
    )
    const hasSchema = titles.includes('Routines') && titles.includes('Log')
    const isTemplate = titles.includes('_meta')
    return { hasSchema, isTemplate }
  } catch { return { hasSchema: false, isTemplate: false } }
}

async function checkMetaType(spreadsheetId: string): Promise<string | null> {
  try {
    const url = `${SHEETS_BASE}/${spreadsheetId}/values/_meta!A1`
    const res = await authFetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data.values?.[0]?.[0] ?? null
  } catch { return null }
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

export async function createSharedTemplate(
  programRows: RoutineRow[],
  programNames: string[]
): Promise<{ spreadsheetId: string; url: string }> {
  const title = `repsheets - Shared: ${programNames.join(', ')}`
  const createRes = await authFetch(SHEETS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: 'Routines' } },
        { properties: { title: 'Log' } },
        { properties: { title: '_meta' } },
      ],
    }),
  })
  if (!createRes.ok) throw new Error('Failed to create shared template')
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
  await writeRange(spreadsheetId, '_meta!A1', [['type=shared_template']])

  // Set to "anyone with link can view"
  await authFetch(`${DRIVE_BASE}/files/${spreadsheetId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  return { spreadsheetId, url }
}

export async function createCompeteSheet(
  programRows: RoutineRow[],
  programNames: string[]
): Promise<string> {
  const title = `repsheets - Compete: ${programNames.join(', ')}`
  const createRes = await authFetch(SHEETS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: 'Routines' } },
        { properties: { title: 'Log' } },
      ],
    }),
  })
  if (!createRes.ok) throw new Error('Failed to create compete sheet')
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

export async function inviteByEmail(spreadsheetId: string, email: string): Promise<void> {
  const res = await authFetch(`${DRIVE_BASE}/files/${spreadsheetId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message ?? 'Failed to share')
  }
}

export async function inviteByLink(spreadsheetId: string): Promise<string> {
  const res = await authFetch(`${DRIVE_BASE}/files/${spreadsheetId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'writer', type: 'anyone' }),
  })
  if (!res.ok) throw new Error('Failed to create share link')
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
}

export async function renameSheet(spreadsheetId: string, newName: string): Promise<void> {
  const res = await authFetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ updateSpreadsheetProperties: { properties: { title: newName }, fields: 'title' } }],
    }),
  })
  if (!res.ok) throw new Error('Failed to rename sheet')
}

export async function readSheetInfo(spreadsheetId: string): Promise<{ name: string; metaType: string | null }> {
  const url = `${SHEETS_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties.title`
  const res = await authFetch(url)
  if (!res.ok) throw new Error('Failed to read sheet info')
  const data = await res.json()
  const titles = (data.sheets ?? []).map(
    (s: { properties: { title: string } }) => s.properties.title
  )
  const metaType = titles.includes('_meta') ? await checkMetaType(spreadsheetId) : null
  return { name: data.properties.title, metaType }
}

export async function appendRoutineRows(spreadsheetId: string, rows: RoutineRow[]): Promise<void> {
  const values = rows.map((r) => [
    r.program, r.routine, r.exercise, r.sets,
    r.reps ?? '', r.value ?? '', r.unit, r.notes,
  ])
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/Routines!A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) throw new Error('Failed to append routines')
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
