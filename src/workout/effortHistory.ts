import type { LogEntry } from '../types'
import { rirToRpe } from './rpe'

/** The RPE-equivalent effort a log was performed at, or null if none was recorded.
 * RIR is converted to RPE so a set logged at 2 RIR matches one prescribed at RPE 8. */
function effortRpe(log: LogEntry): number | null {
  if (log.achievedRpe != null) return log.achievedRpe
  if (log.achievedRir != null) return rirToRpe(log.achievedRir)
  return null
}

/**
 * The most recent weight the athlete logged for this exercise at the same effort
 * (RPE-equivalent), preferring sets at the same rep count. Returns null when there's
 * no matching history — the caller falls back to an e1RM-based estimate.
 */
export function lastWeightAtEffort(
  logs: LogEntry[],
  exercise: string,
  athlete: string,
  reps: number,
  targetRpe: number,
): number | null {
  const matches = logs.filter(
    (l) =>
      l.exercise === exercise &&
      l.athlete === athlete &&
      l.value != null &&
      l.value > 0 &&
      effortRpe(l) === targetRpe,
  )
  if (matches.length === 0) return null

  const sameReps = matches.filter((l) => l.reps === reps)
  const pool = sameReps.length > 0 ? sameReps : matches
  pool.sort((a, b) => b.date.localeCompare(a.date))
  return pool[0].value
}
