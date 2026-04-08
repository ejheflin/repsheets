import type { RoutineRow, ExpandedSet } from '../types'

interface ParsedSets {
  count: number
  supersetGroup: string | null
}

function parseSetsColumn(sets: string): ParsedSets {
  const trimmed = sets.trim()
  const match = trimmed.match(/^(\d+)([a-zA-Z])?$/)
  if (!match) {
    return { count: 1, supersetGroup: null }
  }
  return {
    count: parseInt(match[1], 10),
    supersetGroup: match[2]?.toLowerCase() ?? null,
  }
}

export function expandRoutine(rows: RoutineRow[]): ExpandedSet[] {
  const result: ExpandedSet[] = []
  let i = 0
  while (i < rows.length) {
    const exerciseName = rows[i].exercise
    const exerciseRows: RoutineRow[] = []
    while (i < rows.length && rows[i].exercise === exerciseName) {
      exerciseRows.push(rows[i])
      i++
    }
    let currentSet = 1
    for (const row of exerciseRows) {
      const parsed = parseSetsColumn(row.sets)
      const targetSet = parsed.count
      for (let s = currentSet; s <= targetSet; s++) {
        result.push({
          exercise: row.exercise,
          setNumber: s,
          reps: row.reps,
          value: row.value,
          unit: row.unit,
          notes: row.notes,
          supersetGroup: parsed.supersetGroup,
        })
      }
      currentSet = targetSet + 1
    }
  }
  return result
}
