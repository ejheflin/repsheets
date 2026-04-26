import type { RoutineRow, RepSheet } from '../types'
import { authFetch } from '../auth/authFetch'
import { getStoredUser } from '../auth/googleAuth'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files'
const REGISTRY_KEY = 'repsheets_registry_id'
const OLD_JOINED_KEY = 'repsheets_joined_sheets'
const MIGRATION_KEY = 'repsheets_registry_migrated'

// ─── Registry ──────────────────────────────────────────────────────────────

interface RegistryEntry {
  id: string
  name: string
  owner: string
  ownerEmail: string
}

export class NotRepSheetError extends Error {
  constructor() { super('Not a repsheet') }
}

async function getOrCreateRegistry(): Promise<string> {
  const cached = localStorage.getItem(REGISTRY_KEY)
  if (cached) {
    try {
      const res = await authFetch(`${DRIVE_BASE}/files/${cached}?fields=id,trashed`)
      if (res.ok) {
        const data = await res.json()
        if (!data.trashed) return cached
      }
    } catch {}
    localStorage.removeItem(REGISTRY_KEY)
  }

  const q = encodeURIComponent("name='repsheets.registry'")
  const searchRes = await authFetch(
    `${DRIVE_BASE}/files?spaces=appDataFolder&q=${q}&fields=files(id)&pageSize=1`
  )
  if (searchRes.ok) {
    const data = await searchRes.json()
    if (data.files?.length > 0) {
      localStorage.setItem(REGISTRY_KEY, data.files[0].id)
      return data.files[0].id
    }
  }

  const createRes = await authFetch(`${DRIVE_BASE}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'repsheets.registry', parents: ['appDataFolder'] }),
  })
  if (!createRes.ok) throw new Error('Failed to create registry')
  const created = await createRes.json()
  localStorage.setItem(REGISTRY_KEY, created.id)
  await writeRegistryContent(created.id, [])
  return created.id
}

async function readRegistryContent(fileId: string): Promise<RegistryEntry[]> {
  const res = await authFetch(`${DRIVE_BASE}/files/${fileId}?alt=media`)
  if (!res.ok) return []
  try {
    const text = await res.text()
    if (!text.trim()) return []
    return JSON.parse(text)
  } catch { return [] }
}

async function writeRegistryContent(fileId: string, entries: RegistryEntry[]): Promise<void> {
  const res = await authFetch(`${UPLOAD_BASE}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries),
  })
  if (!res.ok) throw new Error('Failed to write registry')
}

async function readRegistry(): Promise<RegistryEntry[]> {
  try {
    const fileId = await getOrCreateRegistry()
    return await readRegistryContent(fileId)
  } catch { return [] }
}

async function addToRegistry(entry: RegistryEntry): Promise<void> {
  const fileId = await getOrCreateRegistry()
  const entries = await readRegistryContent(fileId)
  const idx = entries.findIndex((e) => e.id === entry.id)
  if (idx >= 0) { entries[idx] = entry } else { entries.push(entry) }
  await writeRegistryContent(fileId, entries)
}

export async function registerSheetById(id: string): Promise<void> {
  const sheetsRes = await authFetch(
    `${SHEETS_BASE}/${id}?fields=properties.title,sheets.properties.title`
  )
  if (!sheetsRes.ok) throw new Error('Cannot access sheet')
  const sheetsData = await sheetsRes.json()
  const titles: string[] = (sheetsData.sheets ?? []).map(
    (s: { properties: { title: string } }) => s.properties.title
  )
  if (!titles.includes('Routines') || !titles.includes('Log')) throw new NotRepSheetError()
  const name: string = sheetsData.properties?.title ?? id

  let owner = 'Unknown'
  let ownerEmail = ''
  try {
    const driveRes = await authFetch(`${DRIVE_BASE}/files/${id}?fields=owners`)
    if (driveRes.ok) {
      const driveData = await driveRes.json()
      owner = driveData.owners?.[0]?.displayName ?? 'Unknown'
      ownerEmail = driveData.owners?.[0]?.emailAddress ?? ''
    }
  } catch {}

  await addToRegistry({ id, name, owner, ownerEmail })
}

let migrationAttempted = false

async function migrateOldJoinedSheets(): Promise<void> {
  if (migrationAttempted || localStorage.getItem(MIGRATION_KEY)) return
  migrationAttempted = true
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(OLD_JOINED_KEY) ?? '[]')
    for (const id of ids) {
      try { await registerSheetById(id) } catch {}
    }
    localStorage.setItem(MIGRATION_KEY, '1')
    localStorage.removeItem(OLD_JOINED_KEY)
  } catch {
    migrationAttempted = false // allow retry next session if registry unavailable
  }
}

// ─── Schema check ──────────────────────────────────────────────────────────

interface SheetSchemaInfo {
  hasSchema: boolean
  isTemplate: boolean
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

// ─── List sheets ───────────────────────────────────────────────────────────

export async function listRepSheets(): Promise<RepSheet[]> {
  migrateOldJoinedSheets() // fire-and-forget; completes in background

  const currentUser = getStoredUser()
  const query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  const url = `${DRIVE_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,owners)&pageSize=100`
  const res = await authFetch(url)
  if (!res.ok) throw new Error('Failed to list sheets')
  const data = await res.json()

  const sheets: RepSheet[] = []
  for (const file of data.files ?? []) {
    const info = await checkRepSheetsSchema(file.id)
    if (info.hasSchema) {
      const ownerEmail = file.owners?.[0]?.emailAddress ?? ''
      const isOwner = currentUser?.email === ownerEmail
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

  // Supplement with registry entries (joined/loaded sheets not visible via drive.file)
  const registry = await readRegistry()
  const foundIds = new Set(sheets.map((s) => s.spreadsheetId))
  for (const entry of registry) {
    if (foundIds.has(entry.id)) continue
    try {
      const info = await checkRepSheetsSchema(entry.id)
      if (!info.hasSchema) continue
      const isOwner = currentUser?.email === entry.ownerEmail
      if (isOwner && info.isTemplate) continue
      sheets.push({
        spreadsheetId: entry.id,
        name: entry.name,
        owner: entry.owner,
        ownerEmail: entry.ownerEmail,
        isOwner,
        isTemplate: info.isTemplate,
      })
    } catch {}
  }

  return sheets
}

// ─── Folder helpers ────────────────────────────────────────────────────────

const FOLDER_PREF_KEY = 'repsheets_folder_id'

async function getOrCreateFolder(): Promise<string> {
  const stored = localStorage.getItem(FOLDER_PREF_KEY)
  if (stored) {
    try {
      const res = await authFetch(`${DRIVE_BASE}/files/${stored}?fields=id,trashed`)
      if (res.ok) {
        const data = await res.json()
        if (!data.trashed) return stored
      }
    } catch {}
  }

  const query = "mimeType='application/vnd.google-apps.folder' and name='repsheets' and trashed=false"
  const searchRes = await authFetch(`${DRIVE_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`)
  if (searchRes.ok) {
    const data = await searchRes.json()
    if (data.files?.length > 0) {
      localStorage.setItem(FOLDER_PREF_KEY, data.files[0].id)
      return data.files[0].id
    }
  }

  const createRes = await authFetch(`${DRIVE_BASE}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'repsheets',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  if (!createRes.ok) throw new Error('Failed to create repsheets folder')
  const folder = await createRes.json()
  localStorage.setItem(FOLDER_PREF_KEY, folder.id)
  return folder.id
}

async function moveToFolder(fileId: string, folderId: string) {
  try {
    const getRes = await authFetch(`${DRIVE_BASE}/files/${fileId}?fields=parents`)
    if (!getRes.ok) return
    const data = await getRes.json()
    const prevParents = (data.parents ?? []).join(',')
    await authFetch(`${DRIVE_BASE}/files/${fileId}?addParents=${folderId}&removeParents=${prevParents}`, {
      method: 'PATCH',
    })
  } catch {}
}

export function getFolderUrl(): string | null {
  const id = localStorage.getItem(FOLDER_PREF_KEY)
  return id ? `https://drive.google.com/drive/folders/${id}` : null
}

// ─── Sheet creation ────────────────────────────────────────────────────────

const ROUTINE_HEADERS = ['Program', 'Routine', 'Exercise', 'Sets', 'Reps', 'Value', 'Unit', 'Notes']
const LOG_HEADERS = ['Date', 'Athlete', 'Program', 'Routine', 'Exercise', 'Set', 'Reps', 'Value', 'Unit', 'Notes']

function sheetTitle(programNames?: string[]): string {
  if (!programNames || programNames.length === 0) return 'repsheets'
  const joined = programNames.join(', ')
  const full = `repsheets - ${joined}`
  if (full.length <= 60) return full
  let result = 'repsheets - '
  for (let i = 0; i < programNames.length; i++) {
    const next = i === 0 ? programNames[i] : `, ${programNames[i]}`
    if (result.length + next.length + 5 > 60) {
      result += ` +${programNames.length - i}`
      break
    }
    result += next
  }
  return result
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

export async function createExampleSheet(programRows: RoutineRow[]): Promise<string> {
  const createRes = await authFetch(SHEETS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: sheetTitle() },
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

  try {
    const folderId = await getOrCreateFolder()
    await moveToFolder(spreadsheetId, folderId)
  } catch {}

  return spreadsheetId
}

export async function createSharedTemplate(
  programRows: RoutineRow[],
  programNames: string[]
): Promise<{ spreadsheetId: string; url: string }> {
  const title = sheetTitle(programNames)
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

  await authFetch(`${DRIVE_BASE}/files/${spreadsheetId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  try {
    const folderId = await getOrCreateFolder()
    await moveToFolder(spreadsheetId, folderId)
  } catch {}

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  return { spreadsheetId, url }
}

export async function createCompeteSheet(
  programRows: RoutineRow[],
  programNames: string[]
): Promise<string> {
  const title = sheetTitle(programNames)
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

  try {
    const folderId = await getOrCreateFolder()
    await moveToFolder(spreadsheetId, folderId)
  } catch {}

  return spreadsheetId
}

// ─── Sharing ───────────────────────────────────────────────────────────────

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

export async function cloneSheet(spreadsheetId: string, newName: string): Promise<string> {
  const res = await authFetch(`${DRIVE_BASE}/files/${spreadsheetId}/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  })
  if (!res.ok) throw new Error('Failed to clone sheet')
  const data = await res.json()
  const newId = data.id

  try {
    const folderId = await getOrCreateFolder()
    await moveToFolder(newId, folderId)
  } catch {}

  return newId
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

async function checkMetaType(spreadsheetId: string): Promise<string | null> {
  try {
    const url = `${SHEETS_BASE}/${spreadsheetId}/values/_meta!A1`
    const res = await authFetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data.values?.[0]?.[0] ?? null
  } catch { return null }
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
