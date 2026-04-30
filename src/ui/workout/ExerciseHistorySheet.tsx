import type { LogEntry, WorkoutExercise } from '../../types'

interface Props {
  exercise: WorkoutExercise
  logs: LogEntry[]
  program: string
  onClose: () => void
}

function epley(weight: number, reps: number): number {
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

function formatDate(d: string): string {
  const [, m, day] = d.split('-').map(Number)
  return `${m}/${day}`
}

export function ExerciseHistorySheet({ exercise, logs, program, onClose }: Props) {
  const relevant = logs.filter(
    (l) => l.program === program && l.exercise === exercise.exercise && l.value != null && l.value > 0
  )

  const dateSet = new Set(relevant.map((l) => l.date))
  const dates = [...dateSet].sort().slice(-5)

  const body = (() => {
    if (dates.length === 0) {
      return <p className="text-center text-gray-500 text-xs py-6">No history yet</p>
    }

    // Group: date → setNumber → last matching log entry
    const byDateSet = new Map<string, Map<number, LogEntry>>()
    for (const log of relevant) {
      if (!byDateSet.has(log.date)) byDateSet.set(log.date, new Map())
      byDateSet.get(log.date)!.set(log.set, log)
    }

    const setNumbers = [...new Set(relevant.map((l) => l.set))].sort((a, b) => a - b)

    // Row label: most recently logged reps + pct for each set number
    const setLabels = new Map<number, { reps: number | null; pct: number | null }>()
    for (const setNum of setNumbers) {
      const entries = relevant.filter((l) => l.set === setNum)
      const latest = entries[entries.length - 1]
      setLabels.set(setNum, { reps: latest?.reps ?? null, pct: latest?.pct ?? null })
    }

    // E1RM per date
    const e1rmByDate = new Map<string, number>()
    for (const date of dates) {
      const dateMap = byDateSet.get(date)
      if (!dateMap) continue
      let maxOrm = 0
      for (const [, log] of dateMap) {
        if (log.value == null) continue
        let orm = 0
        if (log.pct != null && log.pct > 0) {
          orm = log.value / (log.pct / 100)
        } else if (log.reps >= 1 && log.reps <= 12) {
          orm = epley(log.value, log.reps)
        }
        if (orm > maxOrm) maxOrm = orm
      }
      if (maxOrm > 0) e1rmByDate.set(date, Math.round(maxOrm / 5) * 5)
    }

    const buildLabel = (setNum: number): string => {
      const { reps, pct } = setLabels.get(setNum) ?? { reps: null, pct: null }
      const r = reps != null ? `${reps}r` : '?r'
      return pct != null ? `${setNum}×${r} @ ${pct}%` : `${setNum}×${r}`
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr>
              <th className="text-left text-gray-500 font-normal pb-2 pr-3 whitespace-nowrap">Set</th>
              {dates.map((d) => (
                <th key={d} className="text-center text-gray-500 font-normal pb-2 px-2 whitespace-nowrap">
                  {formatDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b-2 border-[#3a3a5a]">
              <td className="text-[#6c63ff] font-semibold py-2 pr-3 whitespace-nowrap">E1RM</td>
              {dates.map((d) => (
                <td key={d} className="text-center py-2 px-2 text-white font-semibold tabular-nums">
                  {e1rmByDate.has(d) ? e1rmByDate.get(d) : '—'}
                </td>
              ))}
            </tr>
            {setNumbers.map((setNum) => (
              <tr key={setNum} className="border-b border-[#3a3a5a] last:border-b-0">
                <td className="text-gray-400 py-2 pr-3 whitespace-nowrap">{buildLabel(setNum)}</td>
                {dates.map((d) => {
                  const entry = byDateSet.get(d)?.get(setNum)
                  return (
                    <td key={d} className="text-center py-2 px-2 text-gray-200 tabular-nums">
                      {entry?.value != null ? entry.value : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="bg-[#2a2a4a] rounded-t-[20px] w-full max-h-[60vh] overflow-y-auto"
        style={{ animation: 'slideUpSheet 0.25s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 border-b border-[#3a3a5a]">
          <p className="text-sm font-semibold">{exercise.exercise}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">History — {program}</p>
        </div>
        <div className="px-4 py-3 pb-8">
          {body}
        </div>
      </div>
    </div>
  )
}
