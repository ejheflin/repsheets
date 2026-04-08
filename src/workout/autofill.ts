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
  const matching = logs
    .filter(
      (log) =>
        log.program === program &&
        log.routine === routine &&
        log.exercise === set.exercise &&
        log.set === set.setNumber
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  if (matching.length > 0) {
    const latest = matching[0]
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
