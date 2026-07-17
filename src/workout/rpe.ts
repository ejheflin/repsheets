// RPE → %1RM chart. Keys are RPE values (6.5–10 in 0.5 steps).
// Each array is indexed by reps-1 (index 0 = 1 rep, index 7 = 8 reps).
// Values are percentages (e.g. 100 means 100% of 1RM).
const CHART: Record<number, number[]> = {
  10:  [100, 96, 92, 89, 86, 84, 81, 79],
  9.5: [ 98, 94, 91, 88, 85, 82, 80, 78],
  9:   [ 96, 92, 89, 86, 84, 81, 79, 76],
  8.5: [ 94, 91, 88, 85, 82, 80, 78, 75],
  8:   [ 92, 89, 86, 84, 81, 79, 76, 74],
  7.5: [ 91, 88, 85, 82, 80, 77, 75, 72],
  7:   [ 89, 86, 84, 81, 79, 76, 74, 71],
  6.5: [ 88, 85, 82, 80, 77, 75, 72, 70],
}

export function rpeToRir(rpe: number): number {
  return 10 - rpe
}

export function rirToRpe(rir: number): number {
  return 10 - rir
}

export function rpeToPct(reps: number, rpe: number): number {
  const clampedRpe = Math.min(10, Math.max(6.5, rpe))
  const roundedRpe = Math.round(clampedRpe * 2) / 2
  const clampedReps = Math.min(8, Math.max(1, reps))
  return CHART[roundedRpe][clampedReps - 1] / 100
}

export function rirToPct(reps: number, rir: number): number {
  return rpeToPct(reps, rirToRpe(rir))
}

export function e1rmFromRpe(weight: number, reps: number, rpe: number): number {
  return weight / rpeToPct(reps, rpe)
}

export function suggestWeight(targetReps: number, targetRpe: number, e1rm: number, step = 5): number {
  const raw = e1rm * rpeToPct(targetReps, targetRpe)
  return Math.round(raw / step) * step
}
