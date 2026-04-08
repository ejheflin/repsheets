import type { ExpandedSet, LogEntry } from '../types'

export interface ResolvedValues {
  reps: number | null
  value: number | null
}

export function resolveSetValues(
  set: ExpandedSet,
  logs: LogEntry[],
  program: string,
  routine: string
): ResolvedValues {
  // Find the last matching entry — log is append-only so last = most recent
  let latest: LogEntry | null = null
  for (const log of logs) {
    if (
      log.program === program &&
      log.routine === routine &&
      log.exercise === set.exercise &&
      log.set === set.setNumber
    ) {
      latest = log
    }
  }

  if (latest) {
    return {
      reps: latest.reps,
      value: latest.value,
    }
  }

  return {
    reps: set.reps,
    value: set.value,
  }
}
