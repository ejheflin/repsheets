import { useState } from 'react'
import type { LogEntry, WorkoutExercise } from '../../types'

interface Props {
  exercise: WorkoutExercise
  logs: LogEntry[]
  program: string
  e1rm?: number | null
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

function calcE1rm(log: LogEntry): number | null {
  if (log.value == null || log.value <= 0) return null
  if (log.pct != null && log.pct > 0) return log.value / (log.pct / 100)
  if (log.reps >= 1 && log.reps <= 12) return epley(log.value, log.reps)
  return null
}

function r5(n: number): number {
  return Math.round(n / 5) * 5
}

function ChevronRight() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 1 6 4 2 7" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 2 4 6 7 2" />
    </svg>
  )
}

export function ExerciseHistorySheet({ exercise, logs, program, e1rm, onClose }: Props) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date); else next.add(date)
      return next
    })
  }

  const relevant = logs.filter(
    (l) => l.program === program && l.exercise === exercise.exercise && l.value != null && l.value > 0
  )

  const dateSet = new Set(relevant.map((l) => l.date))
  const dates = [...dateSet].sort().reverse() // most recent first

  if (dates.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
        <div className="bg-[#2a2a4a] rounded-t-[20px] w-full p-5 pb-8" onClick={(e) => e.stopPropagation()}>
          <p className="text-center text-gray-500 text-xs py-4">No history yet</p>
        </div>
      </div>
    )
  }

  // Group: date → list of entries (sorted by set number)
  const byDate = new Map<string, LogEntry[]>()
  for (const log of relevant) {
    if (!byDate.has(log.date)) byDate.set(log.date, [])
    byDate.get(log.date)!.push(log)
  }
  for (const entries of byDate.values()) {
    entries.sort((a, b) => a.set - b.set)
  }

  const th = 'text-center text-[10px] text-gray-500 font-normal pb-2 px-1.5 whitespace-nowrap'
  const td = 'text-center text-[11px] px-1.5 tabular-nums'

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="bg-[#2a2a4a] rounded-t-[20px] w-full max-h-[70vh] flex flex-col"
        style={{ animation: 'slideUpSheet 0.25s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 border-b border-[#3a3a5a] flex-shrink-0 flex justify-between items-start">
          <div>
            <p className="text-sm font-semibold">{exercise.exercise}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">History — {program}</p>
          </div>
          {e1rm != null && (
            <p className="text-[10px] text-gray-400 pt-0.5">Current E1RM: <span className="text-white font-semibold">{e1rm}</span></p>
          )}
        </div>

        <div className="overflow-y-auto pb-8">
          <div className="overflow-x-auto px-4 pt-3">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-[10px] text-gray-500 font-normal pb-2 pr-2 whitespace-nowrap">Date</th>
                  <th className={th}>Sets</th>
                  <th className={th}>Reps</th>
                  <th className={th}>E1RM</th>
                  <th className={th}>Tgt%</th>
                  <th className={th}>Tgt</th>
                  <th className={th}>Wt</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((date) => {
                  const entries = byDate.get(date) ?? []
                  const isExpanded = expandedDates.has(date)

                  // Session summary: best E1RM, heaviest set's pct + weight
                  let bestOrm = 0
                  let heaviest: LogEntry | null = null
                  for (const e of entries) {
                    const orm = calcE1rm(e)
                    if (orm != null && orm > bestOrm) bestOrm = orm
                    if (heaviest === null || (e.value ?? 0) > (heaviest.value ?? 0)) heaviest = e
                  }
                  const sessionE1rm = bestOrm > 0 ? r5(bestOrm) : null
                  const tgtPct = heaviest?.pct ?? null
                  const tgt = sessionE1rm != null && tgtPct != null ? r5(sessionE1rm * tgtPct / 100) : null
                  const maxWt = heaviest?.value ?? null
                  // Reps: first set's reps as representative
                  const repsSummary = entries[0]?.reps ?? null

                  return (
                    <>
                      {/* Collapsed date row */}
                      <tr
                        key={date}
                        className="border-t border-[#3a3a5a] cursor-pointer active:bg-[#1a1a2e]/40"
                        onClick={() => toggleDate(date)}
                      >
                        <td className="py-2 pr-2 whitespace-nowrap">
                          <span className="flex items-center gap-1 text-[11px] font-medium text-gray-300">
                            <span className="text-gray-500">{isExpanded ? <ChevronDown /> : <ChevronRight />}</span>
                            {formatDate(date)}
                          </span>
                        </td>
                        <td className={`${td} py-2 text-gray-300`}>{entries.length}</td>
                        <td className={`${td} py-2 text-gray-300`}>{repsSummary ?? '—'}</td>
                        <td className={`${td} py-2 text-white font-semibold`}>{sessionE1rm ?? '—'}</td>
                        <td className={`${td} py-2 text-gray-300`}>{tgtPct != null ? `${tgtPct}%` : '—'}</td>
                        <td className={`${td} py-2 text-gray-300`}>{tgt ?? '—'}</td>
                        <td className={`${td} py-2 text-gray-300`}>{maxWt ?? '—'}</td>
                      </tr>

                      {/* Expanded per-set rows */}
                      {isExpanded && entries.map((e) => {
                        const setOrm = calcE1rm(e)
                        const setOrmRounded = setOrm != null ? r5(setOrm) : null
                        const setTgt = setOrmRounded != null && e.pct != null ? r5(setOrmRounded * e.pct / 100) : null
                        return (
                          <tr key={`${date}-${e.set}`} className="bg-[#1a1a2e]/60">
                            <td className="py-1.5 pr-2 pl-4 text-[10px] text-gray-500 whitespace-nowrap">Set {e.set}</td>
                            <td className={`${td} py-1.5 text-gray-500`}>—</td>
                            <td className={`${td} py-1.5 text-gray-400`}>{e.reps}</td>
                            <td className={`${td} py-1.5 text-gray-400`}>{setOrmRounded ?? '—'}</td>
                            <td className={`${td} py-1.5 text-gray-400`}>{e.pct != null ? `${e.pct}%` : '—'}</td>
                            <td className={`${td} py-1.5 text-gray-400`}>{setTgt ?? '—'}</td>
                            <td className={`${td} py-1.5 text-gray-300 font-medium`}>{e.value}</td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
