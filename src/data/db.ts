import Dexie, { type Table } from 'dexie'
import type { RoutineRow, LogEntry, WorkoutState } from '../types'

interface StoredRoutine extends RoutineRow {
  id?: number
  spreadsheetId: string
}

interface StoredLog extends LogEntry {
  id?: number
  spreadsheetId: string
  synced: boolean
}

interface Preference {
  key: string
  value: string
}

class RepSheetsDB extends Dexie {
  routines!: Table<StoredRoutine>
  logs!: Table<StoredLog>
  workoutState!: Table<WorkoutState & { id: number }>
  preferences!: Table<Preference>

  constructor() {
    super('repsheets')
    this.version(1).stores({
      routines: '++id, spreadsheetId, program, routine, exercise',
      logs: '++id, spreadsheetId, [program+routine+exercise+set], date, synced',
      workoutState: 'id',
      preferences: 'key',
    })
  }
}

const db = new RepSheetsDB()

export async function saveRoutines(spreadsheetId: string, rows: RoutineRow[]) {
  await db.routines.where({ spreadsheetId }).delete()
  await db.routines.bulkAdd(rows.map((r) => ({ ...r, spreadsheetId })))
}

export async function getRoutines(spreadsheetId: string): Promise<RoutineRow[]> {
  return db.routines.where({ spreadsheetId }).toArray()
}

export async function saveLogs(spreadsheetId: string, entries: LogEntry[]) {
  await db.logs.where({ spreadsheetId, synced: 1 }).delete()
  await db.logs.bulkAdd(
    entries.map((e) => ({ ...e, spreadsheetId, synced: true }))
  )
}

export async function getLogs(spreadsheetId: string): Promise<LogEntry[]> {
  return db.logs.where({ spreadsheetId }).toArray()
}

export async function queueLogEntries(spreadsheetId: string, entries: LogEntry[]) {
  await db.logs.bulkAdd(
    entries.map((e) => ({ ...e, spreadsheetId, synced: false }))
  )
}

export async function getUnsyncedLogs(spreadsheetId: string): Promise<StoredLog[]> {
  return db.logs.where({ spreadsheetId, synced: 0 }).toArray()
}

export async function markLogsSynced(ids: number[]) {
  await db.logs.where('id').anyOf(ids).modify({ synced: true })
}

export async function saveWorkout(state: WorkoutState) {
  await db.workoutState.put({ ...state, id: 1 })
}

export async function getWorkout(): Promise<WorkoutState | undefined> {
  return db.workoutState.get(1)
}

export async function clearWorkout() {
  await db.workoutState.delete(1)
}

export async function getPreference(key: string): Promise<string | undefined> {
  const pref = await db.preferences.get(key)
  return pref?.value
}

export async function setPreference(key: string, value: string) {
  await db.preferences.put({ key, value })
}

export { db }
