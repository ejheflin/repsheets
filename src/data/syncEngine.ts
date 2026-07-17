import { getUnsyncedLogs, markLogsSynced } from './db'
import { appendLogEntries, fetchLogEntries } from '../sheets/sheetsApi'
import type { LogEntry } from '../types'

const entryKey = (e: LogEntry) =>
  [e.date, e.athlete, e.routine, e.exercise, e.set, e.reps, e.value ?? ''].join('|')

export type SyncState = 'synced' | 'pending' | 'offline'

let listeners: ((state: SyncState) => void)[] = []
let currentState: SyncState = navigator.onLine ? 'synced' : 'offline'

export function getSyncState(): SyncState {
  return currentState
}

function setState(state: SyncState) {
  currentState = state
  listeners.forEach((fn) => fn(state))
}

export function onSyncStateChange(fn: (state: SyncState) => void) {
  listeners.push(fn)
  return () => { listeners = listeners.filter((l) => l !== fn) }
}

export async function checkPendingSync(spreadsheetId: string) {
  if (!navigator.onLine) {
    setState('offline')
    return
  }
  const unsynced = await getUnsyncedLogs(spreadsheetId)
  setState(unsynced.length > 0 ? 'pending' : 'synced')
}

// Single-flight: concurrent flushes would each read the same unsynced rows
// and append them twice before either marks them synced.
let flushInFlight: Promise<boolean> | null = null

export function flushSync(spreadsheetId: string): Promise<boolean> {
  if (!flushInFlight) {
    flushInFlight = doFlush(spreadsheetId).finally(() => { flushInFlight = null })
  }
  return flushInFlight
}

async function doFlush(spreadsheetId: string): Promise<boolean> {
  if (!navigator.onLine) {
    setState('offline')
    return false
  }

  const unsynced = await getUnsyncedLogs(spreadsheetId)
  if (unsynced.length === 0) {
    setState('synced')
    return true
  }

  setState('pending')

  try {
    // Read back the sheet first: a previous append may have committed even
    // though its response was lost — blindly re-appending would duplicate
    // the user's sets. If the read fails, stay pending rather than risk it.
    const existingKeys = new Set((await fetchLogEntries(spreadsheetId)).map(entryKey))

    const pending = unsynced.map((row) => {
      const { id, spreadsheetId: _sid, synced: _s, ...entry } = row
      return { id, entry: entry as LogEntry }
    })
    const toAppend = pending.filter((p) => !existingKeys.has(entryKey(p.entry)))

    if (toAppend.length > 0) {
      await appendLogEntries(spreadsheetId, toAppend.map((p) => p.entry))
    }
    const ids = pending.map((p) => p.id).filter((id): id is number => id !== undefined)
    await markLogsSynced(ids)
    setState('synced')
    return true
  } catch {
    // Keep as pending — will retry next time
    return false
  }
}

// Auto-flush when coming back online. Callers may invoke this repeatedly
// (e.g. on every sheet change) — window listeners are only registered once.
let getSpreadsheetIdRef: (() => string | null) | null = null
let windowListenersRegistered = false

export function initSyncListeners(getSpreadsheetId: () => string | null) {
  getSpreadsheetIdRef = getSpreadsheetId

  if (!windowListenersRegistered) {
    windowListenersRegistered = true
    window.addEventListener('online', () => {
      const id = getSpreadsheetIdRef?.()
      if (id) flushSync(id)
    })

    window.addEventListener('offline', () => {
      setState('offline')
    })
  }

  // Check on init
  const id = getSpreadsheetId()
  if (id) checkPendingSync(id)
}
