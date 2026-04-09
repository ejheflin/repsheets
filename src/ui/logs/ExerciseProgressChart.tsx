import { useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ExerciseChipFilter } from './ExerciseChipFilter'
import type { ExerciseHistoryPoint } from '../../data/useLogs'

const CHART_COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

interface ExerciseProgressChartProps {
  exerciseHistory: (name: string, limit?: number) => ExerciseHistoryPoint[]
  uniqueExercises: string[]
  programs: string[]
  programExercises: Map<string, string[]>
}

export function ExerciseProgressChart({ exerciseHistory, uniqueExercises, programs, programExercises }: ExerciseProgressChartProps) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set(uniqueExercises.slice(0, 1))
  })

  // Filter exercises: must have log data, and match selected program if any
  const filteredExercises = useMemo(() => {
    if (!selectedProgram) return uniqueExercises
    const programExs = programExercises.get(selectedProgram) ?? []
    return uniqueExercises.filter((ex) => programExs.includes(ex))
  }, [selectedProgram, uniqueExercises, programExercises])

  // Filter programs to only those with at least one logged exercise
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const exs = programExercises.get(p) ?? []
      return exs.some((ex) => uniqueExercises.includes(ex))
    })
  }, [programs, programExercises, uniqueExercises])

  const toggleProgram = (program: string) => {
    if (selectedProgram === program) {
      setSelectedProgram(null)
    } else {
      setSelectedProgram(program)
      // Clear exercise selections that aren't in the new program
      const programExs = programExercises.get(program) ?? []
      setSelected((prev) => {
        const next = new Set<string>()
        for (const ex of prev) {
          if (programExs.includes(ex)) next.add(ex)
        }
        return next
      })
    }
  }

  const toggle = (ex: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ex)) next.delete(ex)
      else next.add(ex)
      return next
    })
  }

  const { data, activeExercises } = useMemo(() => {
    const active = [...selected]
    const histories = active.map((ex) => ({
      name: ex,
      points: exerciseHistory(ex, 10),
    }))
    const allDates = new Set<string>()
    histories.forEach((h) => h.points.forEach((p) => allDates.add(p.date)))
    const sortedDates = [...allDates].sort()
    const merged = sortedDates.map((date) => {
      const entry: Record<string, string | number> = { date: date.slice(5) }
      histories.forEach((h) => {
        const point = h.points.find((p) => p.date === date)
        entry[h.name] = point?.maxWeight ?? 0
      })
      return entry
    })
    return { data: merged, activeExercises: active }
  }, [selected, exerciseHistory])

  if (uniqueExercises.length === 0) return null

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">Progress</span>
        <div className="flex bg-[#1a1a2e] rounded-md p-0.5">
          <button onClick={() => setChartType('bar')}
            className={`px-2 py-1 rounded transition ${chartType === 'bar' ? 'bg-[#2a2a4a]' : ''}`}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={chartType === 'bar' ? '#fff' : '#555'} strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="14" x2="3" y2="6" /><line x1="8" y1="14" x2="8" y2="2" /><line x1="13" y1="14" x2="13" y2="9" />
            </svg>
          </button>
          <button onClick={() => setChartType('line')}
            className={`px-2 py-1 rounded transition ${chartType === 'line' ? 'bg-[#2a2a4a]' : ''}`}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={chartType === 'line' ? '#fff' : '#555'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 12 5 6 9 9 15 3" />
            </svg>
          </button>
        </div>
      </div>

      {filteredPrograms.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-3 px-3 scrollbar-hide">
          {filteredPrograms.map((p) => (
            <button key={p} onClick={() => toggleProgram(p)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition border ${
                selectedProgram === p
                  ? 'border-[#6c63ff] text-[#6c63ff] bg-[#6c63ff]/10'
                  : 'border-[#3a3a5a] text-gray-500'
              }`}>
              {p}
            </button>
          ))}
        </div>
      )}

      <ExerciseChipFilter exercises={filteredExercises} selected={selected} onToggle={toggle} />

      {activeExercises.length > 0 && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          {chartType === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 5, bottom: 0, left: -15 }}>
              <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#888' }}
                cursor={{ fill: 'transparent', stroke: '#6c63ff', strokeDasharray: '4 2', strokeWidth: 1 }}
              />
              {activeExercises.length > 1 && (
                <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
              )}
              {activeExercises.map((ex, i) => (
                <Bar key={ex} dataKey={ex} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} barSize={16} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 5, bottom: 0, left: -15 }}>
              <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#888' }}
              />
              {activeExercises.length > 1 && (
                <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
              )}
              {activeExercises.map((ex, i) => (
                <Line key={ex} type="monotone" dataKey={ex} stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      ) : (
        <p className="text-gray-500 text-xs text-center py-8">Select an exercise to see progress</p>
      )}
    </div>
  )
}
