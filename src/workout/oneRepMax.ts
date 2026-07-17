import type { LogEntry } from '../types'
import { e1rmFromRpe, rirToRpe } from './rpe'

function epley(weight: number, reps: number): number {
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/**
 * Estimates 1RM averaged across the last 3 workout sessions.
 *
 * setToPct maps set number → programmed percentage for the current routine.
 * When a log entry matches a percentage-programmed set, 1RM is derived directly
 * as weight / (pct/100) — far more accurate than Epley for submaximal work.
 * When the athlete logged an achieved RPE/RIR, 1RM is derived from the RPE chart
 * (weight / %1RM-at-that-RPE), which closes the autoregulation loop. Falls back to
 * Epley for absolute-weight sets with no RPE recorded (reps 1–12 only).
 */
export function estimateOneRepMax(
  logs: LogEntry[],
  exercise: string,
  athlete: string,
  setToPct?: Map<number, number | null | undefined>,
): number | null {
  const byDate = new Map<string, number>()

  for (const log of logs) {
    if (log.athlete !== athlete) continue
    if (log.exercise !== exercise) continue
    if (log.value === null || log.value <= 0) continue

    const pct = (log.pct != null && log.pct > 0) ? log.pct : setToPct?.get(log.set)
    let est: number
    if (pct != null && pct > 0) {
      est = log.value / (pct / 100)
    } else if (log.achievedRpe != null) {
      // Same reps window as Epley — the RPE chart is meaningless past ~12 reps
      if (log.reps < 1 || log.reps > 12) continue
      est = e1rmFromRpe(log.value, log.reps, log.achievedRpe)
    } else if (log.achievedRir != null) {
      if (log.reps < 1 || log.reps > 12) continue
      est = e1rmFromRpe(log.value, log.reps, rirToRpe(log.achievedRir))
    } else {
      if (log.reps < 1 || log.reps > 12) continue
      est = epley(log.value, log.reps)
    }

    const current = byDate.get(log.date) ?? 0
    if (est > current) byDate.set(log.date, est)
  }

  const dates = [...byDate.keys()].sort().slice(-3)
  if (dates.length === 0) return null

  const avg = dates.reduce((sum, d) => sum + byDate.get(d)!, 0) / dates.length
  return Math.round(avg)
}
