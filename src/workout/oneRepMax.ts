import type { LogEntry } from '../types'

function epley(weight: number, reps: number): number {
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/**
 * Estimates 1RM using Epley formula averaged across the last 3 workout sessions.
 * Only considers sets with 1–12 reps (estimates degrade above 12).
 * Returns null when no qualifying logs exist.
 */
export function estimateOneRepMax(
  logs: LogEntry[],
  exercise: string,
  athlete: string,
): number | null {
  const byDate = new Map<string, number>()

  for (const log of logs) {
    if (log.athlete !== athlete) continue
    if (log.exercise !== exercise) continue
    if (log.value === null || log.value <= 0) continue
    if (log.reps < 1 || log.reps > 12) continue

    const est = epley(log.value, log.reps)
    const current = byDate.get(log.date) ?? 0
    if (est > current) byDate.set(log.date, est)
  }

  const dates = [...byDate.keys()].sort().slice(-3)
  if (dates.length === 0) return null

  const avg = dates.reduce((sum, d) => sum + byDate.get(d)!, 0) / dates.length
  return Math.round(avg)
}
