import { getUnsyncedLogs, markLogsSynced } from './db'
import { appendLogEntries } from '../sheets/sheetsApi'
import type { LogEntry } from '../types'

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

export async function flushSync(spreadsheetId: string): Promise<boolean> {
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
    const entries: LogEntry[] = unsynced.map(({ id: _id, spreadsheetId: _sid, synced: _s, ...entry }) => entry as LogEntry)
    await appendLogEntries(spreadsheetId, entries)
    const ids = unsynced.map((l) => l.id).filter((id): id is number => id !== undefined)
    await markLogsSynced(ids)
    setState('synced')
    return true
  } catch {
    // Keep as pending — will retry next time
    return false
  }
}

// Auto-flush when coming back online
export function initSyncListeners(getSpreadsheetId: () => string | null) {
  window.addEventListener('online', () => {
    const id = getSpreadsheetId()
    if (id) flushSync(id)
  })

  window.addEventListener('offline', () => {
    setState('offline')
  })

  // Check on init
  const id = getSpreadsheetId()
  if (id) checkPendingSync(id)
}
